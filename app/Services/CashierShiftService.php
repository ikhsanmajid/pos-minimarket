<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\CashierShiftStatus;
use App\Enums\PaymentMethod;
use App\Enums\ShiftCashMovementType;
use App\Enums\UserRoles;
use App\Models\CashierShift;
use App\Models\ShiftCashMovement;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class CashierShiftService
{
    /**
     * Nominal minimal Cash Out yang wajib diotorisasi PIN Admin/Supervisor untuk kasir.
     */
    public const float CASH_OUT_PIN_THRESHOLD = 100000.0;

    /**
     * Batas toleransi selisih kas (absolut) sebelum wajib otorisasi PIN Admin/Supervisor saat tutup shift.
     */
    public const float VARIANCE_PIN_THRESHOLD = 10000.0;

    /**
     * Daftar pecahan mata uang Rupiah untuk kalkulator blind closing.
     *
     * @var array<int, int>
     */
    public const array DENOMINATIONS = [
        100000,
        50000,
        20000,
        10000,
        5000,
        2000,
        1000,
        500,
        200,
        100,
    ];

    /**
     * Status transaksi yang dianggap sebagai penjualan sah.
     *
     * @var array<int, string>
     */
    public const array COMPLETED_TRANSACTION_STATUSES = [
        'completed',
        'paid',
        'success',
        'settled',
    ];

    /**
     * Status transaksi yang dianggap sebagai refund / pengembalian dana.
     *
     * @var array<int, string>
     */
    public const array REFUNDED_TRANSACTION_STATUSES = [
        'refunded',
        'refund',
    ];

    public function __construct(
        public FinanceService $financeService,
        public StoreSettingService $storeSettingService,
    ) {}

    public function getVarianceTolerance(): float
    {
        return (float) $this->storeSettingService->get()->shift_variance_tolerance;
    }

    public function getActiveShiftForUser(User $user): ?CashierShift
    {
        return CashierShift::where('user_id', $user->id)
            ->where('status', CashierShiftStatus::Open->value)
            ->latest('opened_at')
            ->first();
    }

    /**
     * Membuka sesi shift baru secara atomik dengan penguncian baris user agar tidak terjadi double-open.
     *
     * @param  array{register_name: string, starting_cash: float|int|string}  $data
     */
    public function openShift(User $actor, array $data): CashierShift
    {
        return DB::transaction(function () use ($actor, $data): CashierShift {
            // Kunci baris user untuk mencegah race condition buka shift dari dua tab bersamaan
            User::where('id', $actor->id)->lockForUpdate()->firstOrFail();

            $existingShift = CashierShift::where('user_id', $actor->id)
                ->where('status', CashierShiftStatus::Open->value)
                ->lockForUpdate()
                ->first();

            if ($existingShift) {
                throw ValidationException::withMessages([
                    'shift' => "Anda masih memiliki sesi shift aktif ({$existingShift->shift_number} - {$existingShift->register_name}). Tutup shift tersebut terlebih dahulu.",
                ]);
            }

            $startingCash = round(max(0, (float) $data['starting_cash']), 2);
            $registerName = trim($data['register_name']) ?: 'Kasir 1';

            $shift = CashierShift::create([
                'user_id' => $actor->id,
                'register_name' => $registerName,
                'status' => CashierShiftStatus::Open,
                'opened_at' => now(),
                'starting_cash' => $startingCash,
            ]);

            activity(ActivityLogCategory::CashierShift->value)
                ->event('opened')
                ->performedOn($shift)
                ->causedBy($actor)
                ->withProperties([
                    'shift_number' => $shift->shift_number,
                    'register_name' => $shift->register_name,
                    'starting_cash' => $startingCash,
                ])
                ->log(sprintf(
                    'Sesi Shift %s (%s) dibuka oleh %s dengan modal awal Rp %s.',
                    $shift->shift_number,
                    $shift->register_name,
                    $actor->name,
                    number_format($startingCash, 0, ',', '.')
                ));

            return $shift->load(['user:id,name,email,role']);
        });
    }

    /**
     * Mencatat mutasi kas tengah shift (cash_in, cash_out, cash_drop) + sinkronisasi akun keuangan.
     *
     * @param  array{type: string, amount: float|int|string, reason: string, financial_account_id?: int|string|null, supervisor_pin?: string|null}  $data
     */
    public function recordCashMovement(CashierShift $shift, array $data, User $actor): ShiftCashMovement
    {
        return DB::transaction(function () use ($shift, $data, $actor): ShiftCashMovement {
            /** @var CashierShift $lockedShift */
            $lockedShift = CashierShift::where('id', $shift->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedShift->isOpen()) {
                throw ValidationException::withMessages([
                    'shift' => "Sesi shift {$lockedShift->shift_number} sudah ditutup sehingga tidak dapat menerima mutasi kas.",
                ]);
            }

            $type = ShiftCashMovementType::from($data['type']);
            $amount = round((float) $data['amount'], 2);
            $reason = trim($data['reason']);
            $accountId = ! empty($data['financial_account_id']) ? (int) $data['financial_account_id'] : null;

            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => 'Nominal mutasi kas harus lebih besar dari 0.',
                ]);
            }

            $requiresApproval = $type === ShiftCashMovementType::CashDrop
                || ($type === ShiftCashMovementType::CashOut && $amount >= self::CASH_OUT_PIN_THRESHOLD);

            $approvedBy = null;
            $approverName = null;

            if ($requiresApproval) {
                if ($actor->hasRoles([UserRoles::Admin, UserRoles::Supervisor])) {
                    $approvedBy = $actor->id;
                    $approverName = $actor->name;
                } else {
                    $supervisor = $this->verifySupervisorPin($data['supervisor_pin'] ?? null);
                    $approvedBy = $supervisor->id;
                    $approverName = $supervisor->name;
                }
            } elseif (! empty($data['supervisor_pin'])) {
                $supervisor = $this->verifySupervisorPin($data['supervisor_pin']);
                $approvedBy = $supervisor->id;
                $approverName = $supervisor->name;
            }

            $movement = ShiftCashMovement::create([
                'cashier_shift_id' => $lockedShift->id,
                'type' => $type,
                'amount' => $amount,
                'reason' => $reason,
                'financial_account_id' => $accountId,
                'approved_by' => $approvedBy,
                'created_by' => $actor->id,
            ]);

            $finTx = $this->financeService->syncShiftCashMovement($movement, $lockedShift, $actor);

            // Perbarui ringkasan sementara di shift agar live counter konsisten
            $this->refreshMovementSnapshots($lockedShift);

            $movement->load(['financialAccount:id,code,name', 'approver:id,name', 'creator:id,name']);

            activity(ActivityLogCategory::CashierShift->value)
                ->event($type->value)
                ->performedOn($lockedShift)
                ->causedBy($actor)
                ->withProperties([
                    'shift_number' => $lockedShift->shift_number,
                    'movement_type' => $type->value,
                    'amount' => $amount,
                    'reason' => $reason,
                    'financial_account' => $movement->financialAccount?->name,
                    'approved_by' => $approverName,
                    'financial_transaction_number' => $finTx?->transaction_number,
                ])
                ->log(sprintf(
                    '%s sebesar Rp %s pada Shift %s (%s). Alasan: %s',
                    $type->label(),
                    number_format($amount, 0, ',', '.'),
                    $lockedShift->shift_number,
                    $lockedShift->register_name,
                    $reason
                ));

            return $movement;
        });
    }

    /**
     * Menghitung ringkasan transaksi & expected_cash secara real-time untuk sebuah shift.
     *
     * @return array{
     *     starting_cash: float,
     *     total_cash_sales: float,
     *     total_non_cash_sales: float,
     *     total_sales: float,
     *     total_refunds: float,
     *     total_cash_refunds: float,
     *     total_cash_in: float,
     *     total_cash_out: float,
     *     total_cash_drop: float,
     *     total_transactions: int,
     *     expected_cash: float,
     *     payment_breakdown: array<int, array{method: string, label: string, count: int, total: float}>
     * }
     */
    public function calculateShiftTotals(CashierShift $shift): array
    {
        $completedRows = Transaction::query()
            ->where('cashier_shift_id', $shift->id)
            ->whereIn('status', self::COMPLETED_TRANSACTION_STATUSES)
            ->selectRaw('payment_method, COUNT(*) as tx_count, COALESCE(SUM(grand_total), 0) as total_amount')
            ->groupBy('payment_method')
            ->get();

        $totalCashSales = 0.0;
        $totalNonCashSales = 0.0;
        $totalTransactions = 0;
        $paymentBreakdown = [];

        foreach ($completedRows as $row) {
            $methodValue = strtolower((string) $row->payment_method);
            $count = (int) $row->tx_count;
            $amount = round((float) $row->total_amount, 2);

            $totalTransactions += $count;

            if ($methodValue === PaymentMethod::Cash->value) {
                $totalCashSales = round($totalCashSales + $amount, 2);
            } else {
                $totalNonCashSales = round($totalNonCashSales + $amount, 2);
            }

            $enum = PaymentMethod::tryFrom($methodValue);
            $paymentBreakdown[] = [
                'method' => $methodValue,
                'label' => $enum ? $enum->label() : ucfirst($methodValue),
                'count' => $count,
                'total' => $amount,
            ];
        }

        $totalRefunds = round((float) Transaction::query()
            ->where('cashier_shift_id', $shift->id)
            ->whereIn('status', self::REFUNDED_TRANSACTION_STATUSES)
            ->sum('grand_total'), 2);

        $totalCashRefunds = round((float) Transaction::query()
            ->where('cashier_shift_id', $shift->id)
            ->whereIn('status', self::REFUNDED_TRANSACTION_STATUSES)
            ->where('payment_method', PaymentMethod::Cash->value)
            ->sum('grand_total'), 2);

        $movementSums = ShiftCashMovement::query()
            ->where('cashier_shift_id', $shift->id)
            ->selectRaw('type, COALESCE(SUM(amount), 0) as total_amount')
            ->groupBy('type')
            ->pluck('total_amount', 'type');

        $totalCashIn = round((float) ($movementSums[ShiftCashMovementType::CashIn->value] ?? 0), 2);
        $totalCashOut = round((float) ($movementSums[ShiftCashMovementType::CashOut->value] ?? 0), 2);
        $totalCashDrop = round((float) ($movementSums[ShiftCashMovementType::CashDrop->value] ?? 0), 2);

        $startingCash = round((float) $shift->starting_cash, 2);

        $expectedCash = round(
            $startingCash
            + $totalCashSales
            - $totalCashRefunds
            + $totalCashIn
            - $totalCashOut
            - $totalCashDrop,
            2
        );

        return [
            'starting_cash' => $startingCash,
            'total_cash_sales' => $totalCashSales,
            'total_non_cash_sales' => $totalNonCashSales,
            'total_sales' => round($totalCashSales + $totalNonCashSales, 2),
            'total_refunds' => $totalRefunds,
            'total_cash_refunds' => $totalCashRefunds,
            'total_cash_in' => $totalCashIn,
            'total_cash_out' => $totalCashOut,
            'total_cash_drop' => $totalCashDrop,
            'total_transactions' => $totalTransactions,
            'expected_cash' => $expectedCash,
            'payment_breakdown' => $paymentBreakdown,
        ];
    }

    /**
     * Menutup sesi shift secara atomik (Blind Closing + verifikasi variance + sinkronisasi FinanceService).
     *
     * @param  array{
     *     actual_cash: float|int|string,
     *     denomination_breakdown?: array<int, array{denomination: int, qty: int, subtotal: float|int}>|null,
     *     closing_notes?: string|null,
     *     supervisor_pin?: string|null,
     *     cash_deposit_account_id?: int|string|null,
     *     non_cash_deposit_account_id?: int|string|null
     * }  $data
     */
    public function closeShift(CashierShift $shift, array $data, User $actor): CashierShift
    {
        return DB::transaction(function () use ($shift, $data, $actor): CashierShift {
            /** @var CashierShift $lockedShift */
            $lockedShift = CashierShift::where('id', $shift->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedShift->isOpen()) {
                throw ValidationException::withMessages([
                    'shift' => "Sesi shift {$lockedShift->shift_number} sudah ditutup sebelumnya.",
                ]);
            }

            $totals = $this->calculateShiftTotals($lockedShift);

            $normalizedBreakdown = $this->normalizeDenominationBreakdown($data['denomination_breakdown'] ?? null);
            $actualCash = round((float) $data['actual_cash'], 2);

            if ($normalizedBreakdown !== null) {
                $breakdownTotal = round(
                    array_reduce(
                        $normalizedBreakdown,
                        fn (float $carry, array $item): float => $carry + (float) $item['subtotal'],
                        0.0
                    ),
                    2
                );

                if ($breakdownTotal > 0 || $actualCash === 0.0) {
                    $actualCash = $breakdownTotal;
                }
            }

            $expectedCash = $totals['expected_cash'];
            $cashVariance = round($actualCash - $expectedCash, 2);
            $closingNotes = isset($data['closing_notes']) ? trim((string) $data['closing_notes']) : null;

            $hasVariance = abs($cashVariance) >= 0.01;
            if ($hasVariance && empty($closingNotes)) {
                throw ValidationException::withMessages([
                    'closing_notes' => 'Catatan penutupan wajib diisi karena hasil hitung fisik tidak sama dengan ekspektasi sistem.',
                ]);
            }

            $verifiedBy = null;
            $verifierName = null;
            $varianceTolerance = $this->getVarianceTolerance();
            $requiresPin = abs($cashVariance) > $varianceTolerance;

            if ($requiresPin) {
                if ($actor->hasRoles([UserRoles::Admin, UserRoles::Supervisor])) {
                    $verifiedBy = $actor->id;
                    $verifierName = $actor->name;
                } else {
                    $supervisor = $this->verifySupervisorPin(
                        $data['supervisor_pin'] ?? null,
                        sprintf(
                            'Terdapat selisih kas melebihi batas toleransi Rp %s. Diperlukan PIN Admin/Supervisor untuk menutup shift.',
                            number_format($varianceTolerance, 0, ',', '.')
                        )
                    );
                    $verifiedBy = $supervisor->id;
                    $verifierName = $supervisor->name;
                }
            } elseif (! empty($data['supervisor_pin'])) {
                $supervisor = $this->verifySupervisorPin($data['supervisor_pin']);
                $verifiedBy = $supervisor->id;
                $verifierName = $supervisor->name;
            } elseif ($actor->hasRoles([UserRoles::Admin, UserRoles::Supervisor])) {
                $verifiedBy = $actor->id;
                $verifierName = $actor->name;
            }

            $lockedShift->update([
                'status' => CashierShiftStatus::Closed,
                'closed_at' => now(),
                'expected_cash' => $expectedCash,
                'actual_cash' => $actualCash,
                'cash_variance' => $cashVariance,
                'total_cash_sales' => $totals['total_cash_sales'],
                'total_non_cash_sales' => $totals['total_non_cash_sales'],
                'total_refunds' => $totals['total_refunds'],
                'total_cash_in' => $totals['total_cash_in'],
                'total_cash_out' => $totals['total_cash_out'],
                'total_cash_drop' => $totals['total_cash_drop'],
                'total_transactions' => $totals['total_transactions'],
                'denomination_breakdown' => $normalizedBreakdown,
                'closing_notes' => $closingNotes ?: null,
                'verified_by' => $verifiedBy,
            ]);

            // Setoran tunai bersih di luar modal awal (karena cash_drop sudah tercatat saat terjadi)
            $netCashDeposit = max(0.0, round($actualCash - $totals['starting_cash'], 2));

            $syncResult = $this->financeService->syncShiftClosing(
                shift: $lockedShift,
                netCashDeposit: $netCashDeposit,
                nonCashSales: $totals['total_non_cash_sales'],
                actor: $actor,
                cashDepositAccountId: ! empty($data['cash_deposit_account_id']) ? (int) $data['cash_deposit_account_id'] : null,
                nonCashDepositAccountId: ! empty($data['non_cash_deposit_account_id']) ? (int) $data['non_cash_deposit_account_id'] : null
            );

            $varianceLabel = match (true) {
                abs($cashVariance) < 0.01 => 'Klop (Sesuai)',
                $cashVariance < 0 => 'Minus (Kurang)',
                default => 'Surplus (Lebih)',
            };

            activity(ActivityLogCategory::CashierShift->value)
                ->event('closed')
                ->performedOn($lockedShift)
                ->causedBy($actor)
                ->withProperties([
                    'shift_number' => $lockedShift->shift_number,
                    'register_name' => $lockedShift->register_name,
                    'starting_cash' => $totals['starting_cash'],
                    'expected_cash' => $expectedCash,
                    'actual_cash' => $actualCash,
                    'cash_variance' => $cashVariance,
                    'variance_status' => $varianceLabel,
                    'total_cash_sales' => $totals['total_cash_sales'],
                    'total_non_cash_sales' => $totals['total_non_cash_sales'],
                    'total_transactions' => $totals['total_transactions'],
                    'cash_deposited' => $syncResult['cash_deposited'],
                    'non_cash_deposited' => $syncResult['non_cash_deposited'],
                    'verified_by' => $verifierName,
                    'closing_notes' => $closingNotes,
                ])
                ->log(sprintf(
                    'Sesi Shift %s (%s) ditutup. Status kas: %s (Selisih: Rp %s).',
                    $lockedShift->shift_number,
                    $lockedShift->register_name,
                    $varianceLabel,
                    number_format($cashVariance, 0, ',', '.')
                ));

            return $lockedShift->fresh(['user:id,name,email,role', 'verifier:id,name,role']) ?? $lockedShift;
        });
    }

    /**
     * Memverifikasi PIN milik Admin atau Supervisor aktif.
     */
    public function verifySupervisorPin(?string $pin, ?string $missingMessage = null): User
    {
        $normalizedPin = trim((string) $pin);

        if ($normalizedPin === '') {
            throw ValidationException::withMessages([
                'supervisor_pin' => $missingMessage ?? 'PIN otorisasi Admin / Supervisor wajib diisi untuk tindakan ini.',
            ]);
        }

        $supervisors = User::query()
            ->whereIn('role', [UserRoles::Admin->value, UserRoles::Supervisor->value])
            ->where('is_active', true)
            ->whereNotNull('pin')
            ->get(['id', 'name', 'role', 'pin']);

        foreach ($supervisors as $supervisor) {
            if (! empty($supervisor->pin) && Hash::check($normalizedPin, $supervisor->pin)) {
                return $supervisor;
            }
        }

        throw ValidationException::withMessages([
            'supervisor_pin' => 'PIN Supervisor / Admin tidak valid atau belum diatur.',
        ]);
    }

    /**
     * @param  array<int, array{denomination: int, qty: int, subtotal: float|int}>|null  $breakdown
     * @return array<int, array{denomination: int, qty: int, subtotal: int}>|null
     */
    private function normalizeDenominationBreakdown(?array $breakdown): ?array
    {
        if (empty($breakdown)) {
            return null;
        }

        $normalized = [];
        foreach ($breakdown as $row) {
            $denom = (int) $row['denomination'];
            $qty = max(0, (int) $row['qty']);
            $normalized[] = [
                'denomination' => $denom,
                'qty' => $qty,
                'subtotal' => $denom * $qty,
            ];
        }

        return $normalized;
    }

    private function refreshMovementSnapshots(CashierShift $shift): void
    {
        $sums = ShiftCashMovement::query()
            ->where('cashier_shift_id', $shift->id)
            ->selectRaw('type, COALESCE(SUM(amount), 0) as total_amount')
            ->groupBy('type')
            ->pluck('total_amount', 'type');

        $shift->update([
            'total_cash_in' => round((float) ($sums[ShiftCashMovementType::CashIn->value] ?? 0), 2),
            'total_cash_out' => round((float) ($sums[ShiftCashMovementType::CashOut->value] ?? 0), 2),
            'total_cash_drop' => round((float) ($sums[ShiftCashMovementType::CashDrop->value] ?? 0), 2),
        ]);
    }
}
