<?php

namespace App\Http\Controllers;

use App\Enums\CashierShiftStatus;
use App\Enums\ShiftCashMovementType;
use App\Enums\UserRoles;
use App\Http\Requests\CloseCashierShiftRequest;
use App\Http\Requests\OpenCashierShiftRequest;
use App\Http\Requests\StoreShiftCashMovementRequest;
use App\Models\CashierShift;
use App\Models\FinancialAccount;
use App\Models\ShiftCashMovement;
use App\Models\User;
use App\Services\CashierShiftService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CashierShiftController extends Controller
{
    public function __construct(public CashierShiftService $shiftService) {}

    /**
     * Halaman Sesi Shift Aktif (buka shift, daftar mutasi kas berjalan, aksi Cash In/Out/Drop & Tutup Shift).
     */
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', CashierShift::class);

        /** @var User $user */
        $user = $request->user();
        $activeShift = $this->shiftService->getActiveShiftForUser($user);

        $activeShiftPayload = null;
        if ($activeShift) {
            $activeShift->load([
                'user:id,name,email,role',
                'cashMovements.financialAccount:id,code,name,type',
                'cashMovements.approver:id,name',
                'cashMovements.creator:id,name',
            ]);

            $liveTransactionCount = $activeShift->transactions()
                ->whereIn('status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES)
                ->count();

            // Blind Closing: JANGAN kirim expected_cash / total_cash_sales saat shift masih open!
            $activeShiftPayload = [
                'id' => $activeShift->id,
                'shift_number' => $activeShift->shift_number,
                'register_name' => $activeShift->register_name,
                'status' => $activeShift->status->value,
                'status_label' => $activeShift->status->label(),
                'cashier_name' => $activeShift->user?->name ?? $user->name,
                'opened_at' => $activeShift->opened_at->format('d M Y H:i'),
                'opened_at_iso' => $activeShift->opened_at->toIso8601String(),
                'opened_at_human' => $activeShift->opened_at->diffForHumans(),
                'starting_cash' => (float) $activeShift->starting_cash,
                'total_cash_in' => (float) $activeShift->total_cash_in,
                'total_cash_out' => (float) $activeShift->total_cash_out,
                'total_cash_drop' => (float) $activeShift->total_cash_drop,
                'live_transactions_count' => $liveTransactionCount,
                'movements' => $activeShift->cashMovements->map(fn (ShiftCashMovement $m): array => [
                    'id' => $m->id,
                    'type' => $m->type->value,
                    'type_label' => $m->type->label(),
                    'type_short' => $m->type->shortLabel(),
                    'amount' => (float) $m->amount,
                    'reason' => $m->reason,
                    'financial_account_name' => $m->financialAccount?->name,
                    'approved_by_name' => $m->approver?->name,
                    'created_by_name' => $m->creator?->name ?? '-',
                    'created_at' => $m->created_at?->format('d M Y H:i'),
                ])->values()->all(),
            ];
        }

        // Untuk Admin / Supervisor: tampilkan daftar semua shift lain yang sedang berjalan di toko
        $openShiftsStore = [];
        if ($user->hasRoles([UserRoles::Admin, UserRoles::Supervisor])) {
            $openShiftsStore = CashierShift::query()
                ->where('status', CashierShiftStatus::Open->value)
                ->with(['user:id,name,role'])
                ->withCount([
                    'transactions as completed_transactions_count' => fn ($q) => $q->whereIn('status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES),
                ])
                ->orderBy('opened_at')
                ->get()
                ->map(fn (CashierShift $s): array => [
                    'id' => $s->id,
                    'shift_number' => $s->shift_number,
                    'register_name' => $s->register_name,
                    'cashier_name' => $s->user?->name ?? '-',
                    'cashier_role' => $s->user?->role?->label() ?? '-',
                    'opened_at' => $s->opened_at->format('d M Y H:i'),
                    'opened_at_human' => $s->opened_at->diffForHumans(),
                    'starting_cash' => (float) $s->starting_cash,
                    'total_cash_drop' => (float) $s->total_cash_drop,
                    'transactions_count' => (int) ($s->completed_transactions_count ?? 0),
                    'is_own' => $s->user_id === $user->id,
                ])
                ->values()
                ->all();
        }

        $recentOwnShifts = CashierShift::query()
            ->where('user_id', $user->id)
            ->where('status', CashierShiftStatus::Closed->value)
            ->latest('closed_at')
            ->limit(5)
            ->get()
            ->map(fn (CashierShift $s): array => [
                'id' => $s->id,
                'shift_number' => $s->shift_number,
                'register_name' => $s->register_name,
                'opened_at' => $s->opened_at->format('d M Y H:i'),
                'closed_at' => $s->closed_at?->format('d M Y H:i'),
                'actual_cash' => (float) $s->actual_cash,
                'expected_cash' => (float) $s->expected_cash,
                'cash_variance' => (float) $s->cash_variance,
                'total_transactions' => (int) $s->total_transactions,
            ])
            ->values()
            ->all();

        $financialAccounts = FinancialAccount::query()
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'type', 'is_default'])
            ->map(fn (FinancialAccount $acc): array => [
                'id' => $acc->id,
                'code' => $acc->code,
                'name' => $acc->name,
                'type' => $acc->type->value,
                'type_label' => $acc->type->label(),
                'is_default' => (bool) $acc->is_default,
            ])
            ->values()
            ->all();

        return Inertia::render('POS/Shifts/CashierShift', [
            'activeShiftDetail' => $activeShiftPayload,
            'openShiftsStore' => $openShiftsStore,
            'recentOwnShifts' => $recentOwnShifts,
            'financialAccounts' => $financialAccounts,
            'movementTypes' => collect(ShiftCashMovementType::cases())->map(fn (ShiftCashMovementType $t): array => [
                'value' => $t->value,
                'label' => $t->label(),
                'short_label' => $t->shortLabel(),
            ])->values()->all(),
            'denominations' => CashierShiftService::DENOMINATIONS,
            'policyRules' => [
                'cash_out_pin_threshold' => CashierShiftService::CASH_OUT_PIN_THRESHOLD,
                'variance_pin_threshold' => $this->shiftService->getVarianceTolerance(),
                'is_privileged' => $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]),
                'can_view_all_history' => $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]),
            ],
        ]);
    }

    /**
     * Halaman Riwayat Shift (Server-side pagination, filter tanggal, kasir, status, dan hanya yang selisih).
     */
    public function history(Request $request): Response
    {
        Gate::authorize('viewAny', CashierShift::class);

        /** @var User $user */
        $user = $request->user();
        $canViewAll = $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
        $likeOperator = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';

        $filters = $request->only([
            'search',
            'user_id',
            'status',
            'has_variance',
            'start_date',
            'end_date',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);
        $perPage = $request->integer('per_page', 15);

        $allowedSorts = [
            'shift_number',
            'register_name',
            'opened_at',
            'closed_at',
            'starting_cash',
            'actual_cash',
            'cash_variance',
            'total_transactions',
        ];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'asc' ? 'asc' : 'desc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $query = CashierShift::query()
            ->with(['user:id,name,role', 'verifier:id,name'])
            ->when(! $canViewAll, fn ($q) => $q->where('user_id', $user->id))
            ->when($canViewAll && $request->filled('user_id') && $request->input('user_id') !== 'all', function ($q) use ($request): void {
                $q->where('user_id', (int) $request->input('user_id'));
            })
            ->when($request->filled('search'), function ($q) use ($request, $likeOperator): void {
                $search = trim((string) $request->input('search'));
                $q->where(function ($sub) use ($search, $likeOperator): void {
                    $sub->where('shift_number', $likeOperator, "%{$search}%")
                        ->orWhere('register_name', $likeOperator, "%{$search}%")
                        ->orWhereHas('user', fn ($u) => $u->where('name', $likeOperator, "%{$search}%"));
                });
            })
            ->when($request->filled('status') && $request->input('status') !== 'all', function ($q) use ($request): void {
                $q->where('status', $request->input('status'));
            })
            ->when(filter_var($request->input('has_variance'), FILTER_VALIDATE_BOOLEAN), function ($q): void {
                $q->where('status', CashierShiftStatus::Closed->value)
                    ->whereNotNull('cash_variance')
                    ->where('cash_variance', '!=', 0);
            })
            ->when($request->filled('start_date'), function ($q) use ($request): void {
                $q->whereDate('opened_at', '>=', (string) $request->input('start_date'));
            })
            ->when($request->filled('end_date'), function ($q) use ($request): void {
                $q->whereDate('opened_at', '<=', (string) $request->input('end_date'));
            });

        if ($hasTableSort) {
            $query->orderBy($tableSort, $tableDirection);
        }

        if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
            $query->orderBy($toolbarSort, $toolbarDirection);
        }

        if (! $hasTableSort && ! $hasToolbarSort) {
            $query->orderByDesc('opened_at')->orderByDesc('id');
        } else {
            $query->orderByDesc('id');
        }

        $shifts = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (CashierShift $shift): array => [
                'id' => $shift->id,
                'shift_number' => $shift->shift_number,
                'register_name' => $shift->register_name,
                'cashier_name' => $shift->user?->name ?? '-',
                'cashier_role' => $shift->user?->role?->label() ?? '-',
                'status' => $shift->status->value,
                'status_label' => $shift->status->label(),
                'opened_at' => $shift->opened_at->format('d M Y H:i'),
                'closed_at' => $shift->closed_at?->format('d M Y H:i'),
                'starting_cash' => (float) $shift->starting_cash,
                'expected_cash' => $shift->status === CashierShiftStatus::Closed ? (float) $shift->expected_cash : null,
                'actual_cash' => $shift->status === CashierShiftStatus::Closed ? (float) $shift->actual_cash : null,
                'cash_variance' => $shift->status === CashierShiftStatus::Closed ? (float) $shift->cash_variance : null,
                'total_cash_sales' => $shift->status === CashierShiftStatus::Closed ? (float) $shift->total_cash_sales : null,
                'total_non_cash_sales' => $shift->status === CashierShiftStatus::Closed ? (float) $shift->total_non_cash_sales : null,
                'total_transactions' => (int) $shift->total_transactions,
                'verified_by_name' => $shift->verifier?->name,
            ]);

        $cashiers = $canViewAll
            ? User::query()
                ->whereIn('role', [UserRoles::Admin->value, UserRoles::Supervisor->value, UserRoles::Cashier->value])
                ->orderBy('name')
                ->get(['id', 'name', 'role'])
                ->map(fn (User $u): array => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'role_name' => $u->role?->label() ?? '-',
                ])
                ->values()
                ->all()
            : [];

        return Inertia::render('POS/Shifts/ShiftHistory', [
            'shifts' => $shifts,
            'filters' => $filters,
            'cashiers' => $cashiers,
            'canViewAll' => $canViewAll,
        ]);
    }

    /**
     * Halaman Detail Shift & Cetak Z-Report.
     */
    public function show(Request $request, CashierShift $cashierShift): Response
    {
        Gate::authorize('view', $cashierShift);

        /** @var User $user */
        $user = $request->user();
        $isPrivileged = $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);

        $cashierShift->load([
            'user:id,name,email,role',
            'verifier:id,name,role',
            'cashMovements.financialAccount:id,code,name',
            'cashMovements.approver:id,name',
            'cashMovements.creator:id,name',
        ]);

        $liveTotals = $this->shiftService->calculateShiftTotals($cashierShift);
        $isClosed = $cashierShift->status === CashierShiftStatus::Closed;

        // Blind closing protection: sembunyikan expected_cash & penjualan tunai jika shift masih open dan user bukan admin/supervisor
        $canRevealFinancials = $isClosed || $isPrivileged;

        $financialAccounts = $cashierShift->isOpen()
            ? FinancialAccount::query()
                ->where('is_active', true)
                ->orderByDesc('is_default')
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'type', 'is_default'])
                ->map(fn (FinancialAccount $acc): array => [
                    'id' => $acc->id,
                    'code' => $acc->code,
                    'name' => $acc->name,
                    'type' => $acc->type->value,
                    'type_label' => $acc->type->label(),
                    'is_default' => (bool) $acc->is_default,
                ])
                ->values()
                ->all()
            : [];

        return Inertia::render('POS/Shifts/DetailCashierShift', [
            'shift' => [
                'id' => $cashierShift->id,
                'shift_number' => $cashierShift->shift_number,
                'register_name' => $cashierShift->register_name,
                'status' => $cashierShift->status->value,
                'status_label' => $cashierShift->status->label(),
                'cashier_name' => $cashierShift->user?->name ?? '-',
                'cashier_email' => $cashierShift->user?->email ?? '-',
                'cashier_role' => $cashierShift->user?->role?->label() ?? '-',
                'opened_at' => $cashierShift->opened_at->format('d M Y H:i:s'),
                'closed_at' => $cashierShift->closed_at?->format('d M Y H:i:s'),
                'starting_cash' => (float) $cashierShift->starting_cash,
                'expected_cash' => $canRevealFinancials
                    ? ($isClosed ? (float) $cashierShift->expected_cash : $liveTotals['expected_cash'])
                    : null,
                'actual_cash' => $isClosed ? (float) $cashierShift->actual_cash : null,
                'cash_variance' => $isClosed ? (float) $cashierShift->cash_variance : null,
                'total_cash_sales' => $canRevealFinancials
                    ? ($isClosed ? (float) $cashierShift->total_cash_sales : $liveTotals['total_cash_sales'])
                    : null,
                'total_non_cash_sales' => $canRevealFinancials
                    ? ($isClosed ? (float) $cashierShift->total_non_cash_sales : $liveTotals['total_non_cash_sales'])
                    : null,
                'total_refunds' => $canRevealFinancials
                    ? ($isClosed ? (float) $cashierShift->total_refunds : $liveTotals['total_refunds'])
                    : null,
                'total_cash_in' => $isClosed ? (float) $cashierShift->total_cash_in : $liveTotals['total_cash_in'],
                'total_cash_out' => $isClosed ? (float) $cashierShift->total_cash_out : $liveTotals['total_cash_out'],
                'total_cash_drop' => $isClosed ? (float) $cashierShift->total_cash_drop : $liveTotals['total_cash_drop'],
                'total_transactions' => $isClosed ? (int) $cashierShift->total_transactions : $liveTotals['total_transactions'],
                'denomination_breakdown' => $cashierShift->denomination_breakdown ?? [],
                'closing_notes' => $cashierShift->closing_notes,
                'verified_by_name' => $cashierShift->verifier?->name,
                'verified_by_role' => $cashierShift->verifier?->role?->label(),
                'payment_breakdown' => $canRevealFinancials ? $liveTotals['payment_breakdown'] : [],
                'movements' => $cashierShift->cashMovements->map(fn (ShiftCashMovement $m): array => [
                    'id' => $m->id,
                    'type' => $m->type->value,
                    'type_label' => $m->type->label(),
                    'type_short' => $m->type->shortLabel(),
                    'amount' => (float) $m->amount,
                    'reason' => $m->reason,
                    'financial_account_name' => $m->financialAccount?->name,
                    'approved_by_name' => $m->approver?->name,
                    'created_by_name' => $m->creator?->name ?? '-',
                    'created_at' => $m->created_at?->format('d M Y H:i'),
                ])->values()->all(),
            ],
            'canRevealFinancials' => $canRevealFinancials,
            'canManage' => Gate::allows('manageMovement', $cashierShift),
            'financialAccounts' => $financialAccounts,
            'denominations' => CashierShiftService::DENOMINATIONS,
            'policyRules' => [
                'cash_out_pin_threshold' => CashierShiftService::CASH_OUT_PIN_THRESHOLD,
                'variance_pin_threshold' => $this->shiftService->getVarianceTolerance(),
                'is_privileged' => $isPrivileged,
            ],
        ]);
    }

    /**
     * Membuka sesi shift baru.
     */
    public function open(OpenCashierShiftRequest $request): RedirectResponse
    {
        Gate::authorize('open', CashierShift::class);

        /** @var User $user */
        $user = $request->user();

        /** @var array{register_name: string, starting_cash: float|int|string} $validated */
        $validated = $request->validated();

        $shift = $this->shiftService->openShift($user, $validated);

        return redirect()->route('pos.shifts.index')
            ->with('success', "Sesi shift {$shift->shift_number} ({$shift->register_name}) berhasil dibuka.");
    }

    /**
     * Mencatat mutasi kas tengah shift (Cash In, Cash Out, Cash Drop).
     */
    public function storeMovement(StoreShiftCashMovementRequest $request, CashierShift $cashierShift): RedirectResponse
    {
        Gate::authorize('manageMovement', $cashierShift);

        /** @var User $user */
        $user = $request->user();

        /** @var array{type: string, amount: float|int|string, reason: string, financial_account_id?: int|string|null, supervisor_pin?: string|null} $validated */
        $validated = $request->validated();

        $movement = $this->shiftService->recordCashMovement($cashierShift, $validated, $user);

        return back()->with('success', sprintf(
            '%s sebesar Rp %s berhasil dicatat.',
            $movement->type->label(),
            number_format((float) $movement->amount, 0, ',', '.')
        ));
    }

    /**
     * Menutup sesi shift (Blind Closing).
     */
    public function close(CloseCashierShiftRequest $request, CashierShift $cashierShift): RedirectResponse
    {
        Gate::authorize('close', $cashierShift);

        /** @var User $user */
        $user = $request->user();

        /** @var array{actual_cash: float|int|string, denomination_breakdown?: array<int, array{denomination: int, qty: int, subtotal: float|int}>|null, closing_notes?: string|null, supervisor_pin?: string|null, cash_deposit_account_id?: int|string|null, non_cash_deposit_account_id?: int|string|null} $validated */
        $validated = $request->validated();

        $closedShift = $this->shiftService->closeShift($cashierShift, $validated, $user);

        return redirect()->route('pos.shifts.show', $closedShift)
            ->with('success', "Sesi shift {$closedShift->shift_number} berhasil ditutup dan disinkronkan ke Keuangan.");
    }
}
