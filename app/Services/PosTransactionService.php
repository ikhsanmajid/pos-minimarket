<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\PaymentMethod;
use App\Enums\RoundingMode;
use App\Enums\StockMovementType;
use App\Enums\TransactionStatus;
use App\Enums\UserRoles;
use App\Models\CashierShift;
use App\Models\HeldTransaction;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionPayment;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PosTransactionService
{
    /**
     * Batas nominal diskon manual untuk kasir sebelum wajib otorisasi PIN Supervisor/Admin.
     */
    public const float MANUAL_DISCOUNT_PIN_THRESHOLD = 0.0;

    public function __construct(
        public CashierShiftService $cashierShiftService,
        public FinanceService $financeService,
        public StoreSettingService $storeSettingService,
        public SupervisorPinService $supervisorPinService,
    ) {}

    /**
     * Pencarian cepat produk aktif berdasarkan barcode produk, barcode unit (multi-UOM), atau nama produk.
     *
     * @return array<int, array{
     *     id: int,
     *     barcode: string,
     *     name: string,
     *     base_unit: string,
     *     sell_price: float,
     *     stock: int,
     *     image: string|null,
     *     matched_unit_id: int|null,
     *     units: array<int, array{id: int, unit_name: string, conversion_factor: int, barcode: string|null, sell_price: float}>
     * }>
     */
    public function lookupProducts(string $query, int $limit = 15): array
    {
        $term = trim($query);
        if ($term === '') {
            return [];
        }

        // 1. Cek kecocokan persis barcode unit (multi-UOM) terlebih dahulu
        /** @var ProductUnit|null $exactUnit */
        $exactUnit = ProductUnit::query()
            ->where('barcode', $term)
            ->where('is_active', true)
            ->whereHas('product', fn ($q) => $q->where('active', true))
            ->with(['product.units' => fn ($q) => $q->where('is_active', true)->orderBy('conversion_factor')])
            ->first();

        if ($exactUnit !== null && $exactUnit->product !== null) {
            return [$this->formatProductLookupRow($exactUnit->product, $exactUnit->id)];
        }

        // 2. Cek kecocokan persis barcode produk
        /** @var Product|null $exactProduct */
        $exactProduct = Product::query()
            ->where('active', true)
            ->where('barcode', $term)
            ->with(['units' => fn ($q) => $q->where('is_active', true)->orderBy('conversion_factor')])
            ->first();

        if ($exactProduct !== null) {
            return [$this->formatProductLookupRow($exactProduct, null)];
        }

        // 3. Pencarian parsial berdasarkan nama / barcode produk / barcode unit
        $likeOperator = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';

        /** @var EloquentCollection<int, Product> $products */
        $products = Product::query()
            ->where('active', true)
            ->where(function ($q) use ($term, $likeOperator): void {
                $q->where('name', $likeOperator, "%{$term}%")
                    ->orWhere('barcode', $likeOperator, "%{$term}%")
                    ->orWhereHas('units', function ($uq) use ($term, $likeOperator): void {
                        $uq->where('is_active', true)
                            ->where('barcode', $likeOperator, "%{$term}%");
                    });
            })
            ->with(['units' => fn ($q) => $q->where('is_active', true)->orderBy('conversion_factor')])
            ->orderBy('name')
            ->limit(max(1, min($limit, 50)))
            ->get();

        return $products
            ->map(fn (Product $product): array => $this->formatProductLookupRow($product, null))
            ->values()
            ->all();
    }

    /**
     * Menghitung pembulatan sesuai konfigurasi RoundingMode toko.
     *
     * @return array{rounded: float, rounding_amount: float}
     */
    public function applyRounding(float $amount, RoundingMode $mode): array
    {
        $cleanAmount = round($amount, 2);

        $rounded = match ($mode) {
            RoundingMode::None => $cleanAmount,
            RoundingMode::Nearest100 => round($cleanAmount / 100) * 100,
            RoundingMode::Down100 => floor($cleanAmount / 100) * 100,
            RoundingMode::Up100 => ceil($cleanAmount / 100) * 100,
            RoundingMode::Nearest500 => round($cleanAmount / 500) * 500,
        };

        $rounded = round($rounded, 2);
        $roundingAmount = round($rounded - $cleanAmount, 2);

        return [
            'rounded' => $rounded,
            'rounding_amount' => $roundingAmount,
        ];
    }

    /**
     * Memproses checkout POS secara atomik dengan pessimistic locking stok & sinkronisasi keuangan.
     *
     * @param  array{
     *     customer_id?: int|null,
     *     held_transaction_id?: int|null,
     *     discount_amount?: float|int|string|null,
     *     supervisor_pin?: string|null,
     *     items: array<int, array{product_id: int, product_unit_id?: int|null, qty: int, discount_amount?: float|int|string|null}>,
     *     payments: array<int, array{payment_method: string, financial_account_id: int, amount: float|int|string, reference_number?: string|null}>
     * }  $data
     */
    public function checkout(User $actor, array $data): Transaction
    {
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($actor);

        if (! $activeShift instanceof CashierShift) {
            throw ValidationException::withMessages([
                'shift' => 'Anda belum memiliki sesi shift aktif. Buka shift terlebih dahulu sebelum melakukan checkout.',
            ]);
        }

        return DB::transaction(function () use ($actor, $activeShift, $data): Transaction {
            /** @var CashierShift $lockedShift */
            $lockedShift = CashierShift::query()
                ->where('id', $activeShift->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedShift->isOpen()) {
                throw ValidationException::withMessages([
                    'shift' => 'Sesi shift Anda sudah ditutup.',
                ]);
            }

            // 1. Urutkan product_id dan lakukan lockForUpdate() untuk mencegah race condition & deadlock PostgreSQL
            $productIds = array_values(array_unique(array_map(
                fn (array $item): int => (int) $item['product_id'],
                $data['items']
            )));
            sort($productIds);

            /** @var EloquentCollection<int, Product> $lockedProducts */
            $lockedProducts = Product::query()
                ->whereIn('id', $productIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $unitIds = array_values(array_unique(array_filter(array_map(
                fn (array $item): ?int => isset($item['product_unit_id']) ? (int) $item['product_unit_id'] : null,
                $data['items']
            ))));

            /** @var EloquentCollection<int, ProductUnit> $unitsMap */
            $unitsMap = ! empty($unitIds)
                ? ProductUnit::query()->whereIn('id', $unitIds)->get()->keyBy('id')
                : new EloquentCollection;

            // 2. Validasi produk, satuan multi-UOM, akumulasi base_qty, dan hitung subtotal di server
            $resolvedLines = [];
            $accumulatedBaseQty = [];
            $grossSubtotal = 0.0;
            $totalItemDiscount = 0.0;

            foreach ($data['items'] as $index => $line) {
                $productId = (int) $line['product_id'];
                /** @var Product|null $product */
                $product = $lockedProducts->get($productId);

                if (! $product instanceof Product || ! $product->active) {
                    throw ValidationException::withMessages([
                        "items.{$index}.product_id" => 'Produk tidak ditemukan atau sedang nonaktif.',
                    ]);
                }

                $qty = (int) $line['qty'];
                if ($qty < 1) {
                    throw ValidationException::withMessages([
                        "items.{$index}.qty" => "Jumlah produk {$product->name} minimal 1.",
                    ]);
                }

                $productUnitId = isset($line['product_unit_id']) ? (int) $line['product_unit_id'] : null;
                $unitName = $product->base_unit ?: 'pcs';
                $conversionFactor = 1;
                $unitPrice = round((float) $product->sell_price, 2);

                if ($productUnitId !== null) {
                    /** @var ProductUnit|null $unit */
                    $unit = $unitsMap->get($productUnitId);
                    if (! $unit instanceof ProductUnit || $unit->product_id !== $product->id || ! $unit->is_active) {
                        throw ValidationException::withMessages([
                            "items.{$index}.product_unit_id" => "Satuan unit untuk produk {$product->name} tidak valid atau nonaktif.",
                        ]);
                    }

                    $unitName = $unit->unit_name;
                    $conversionFactor = max(1, (int) $unit->conversion_factor);
                    $unitPrice = round((float) $unit->sell_price, 2);
                }

                $baseQty = $qty * $conversionFactor;
                $accumulatedBaseQty[$productId] = ($accumulatedBaseQty[$productId] ?? 0) + $baseQty;

                $lineGross = round($unitPrice * $qty, 2);
                $itemDiscount = round(max(0.0, (float) ($line['discount_amount'] ?? 0)), 2);
                if ($itemDiscount > $lineGross) {
                    throw ValidationException::withMessages([
                        "items.{$index}.discount_amount" => "Diskon item {$product->name} tidak boleh melebihi subtotal item.",
                    ]);
                }

                $lineSubtotal = round($lineGross - $itemDiscount, 2);
                $grossSubtotal = round($grossSubtotal + $lineGross, 2);
                $totalItemDiscount = round($totalItemDiscount + $itemDiscount, 2);

                $resolvedLines[] = [
                    'product' => $product,
                    'product_unit_id' => $productUnitId,
                    'unit_name_snapshot' => $unitName,
                    'conversion_factor' => $conversionFactor,
                    'qty' => $qty,
                    'base_qty' => $baseQty,
                    'unit_price' => $unitPrice,
                    'cost_price_snapshot' => round((float) $product->buy_price, 2),
                    'discount_amount' => $itemDiscount,
                    'subtotal' => $lineSubtotal,
                ];
            }

            // 3. Validasi kecukupan stok berdasarkan akumulasi base_qty per product_id
            foreach ($accumulatedBaseQty as $productId => $totalNeeded) {
                /** @var Product $product */
                $product = $lockedProducts->get($productId);
                if ((int) $product->stock < $totalNeeded) {
                    throw ValidationException::withMessages([
                        'items' => sprintf(
                            'Stok %s tidak mencukupi (tersedia: %d %s, dibutuhkan: %d %s).',
                            $product->name,
                            (int) $product->stock,
                            $product->base_unit ?: 'pcs',
                            $totalNeeded,
                            $product->base_unit ?: 'pcs'
                        ),
                    ]);
                }
            }

            // 4. Validasi diskon manual & PIN Supervisor
            $transactionDiscount = round(max(0.0, (float) ($data['discount_amount'] ?? 0)), 2);
            $totalDiscount = round($totalItemDiscount + $transactionDiscount, 2);

            if ($totalDiscount > $grossSubtotal) {
                throw ValidationException::withMessages([
                    'discount_amount' => 'Total diskon tidak boleh melebihi subtotal belanja.',
                ]);
            }

            $discountApprovedBy = null;
            if ($totalDiscount > self::MANUAL_DISCOUNT_PIN_THRESHOLD) {
                if ($actor->hasRoles([UserRoles::Admin, UserRoles::Supervisor]) && empty($data['supervisor_pin'])) {
                    $discountApprovedBy = $actor->id;
                } else {
                    $approver = $this->supervisorPinService->verify(
                        $data['supervisor_pin'] ?? null,
                        'Diskon manual melebihi batas kasir. Masukkan PIN Supervisor / Admin untuk melanjutkan.'
                    );
                    $discountApprovedBy = $approver->id;
                }
            }

            // 5. Kalkulasi PPN & Pembulatan dari StoreSetting
            $storeSetting = $this->storeSettingService->get();
            $taxRate = max(0.0, (float) $storeSetting->default_tax_rate);
            $taxableAmount = round(max(0.0, $grossSubtotal - $totalDiscount), 2);
            $taxAmount = round($taxableAmount * ($taxRate / 100), 2);
            $beforeRounding = round($taxableAmount + $taxAmount, 2);

            $roundingResult = $this->applyRounding($beforeRounding, $storeSetting->rounding_mode);
            $grandTotal = $roundingResult['rounded'];
            $roundingAmount = $roundingResult['rounding_amount'];

            // 6. Validasi pembayaran (single & split payment)
            $paidAmount = 0.0;
            $nonCashAmount = 0.0;
            $normalizedPayments = [];

            foreach ($data['payments'] as $pIndex => $paymentRow) {
                $method = PaymentMethod::from((string) $paymentRow['payment_method']);
                $amount = round((float) $paymentRow['amount'], 2);
                if ($amount <= 0) {
                    throw ValidationException::withMessages([
                        "payments.{$pIndex}.amount" => 'Nominal pembayaran harus lebih besar dari 0.',
                    ]);
                }

                $paidAmount = round($paidAmount + $amount, 2);
                if ($method !== PaymentMethod::Cash) {
                    $nonCashAmount = round($nonCashAmount + $amount, 2);
                }

                $normalizedPayments[] = [
                    'payment_method' => $method,
                    'financial_account_id' => (int) $paymentRow['financial_account_id'],
                    'amount' => $amount,
                    'reference_number' => isset($paymentRow['reference_number']) && trim((string) $paymentRow['reference_number']) !== ''
                        ? trim((string) $paymentRow['reference_number'])
                        : null,
                ];
            }

            if ($paidAmount < $grandTotal) {
                throw ValidationException::withMessages([
                    'payments' => sprintf(
                        'Total pembayaran (Rp %s) kurang dari total tagihan (Rp %s).',
                        number_format($paidAmount, 0, ',', '.'),
                        number_format($grandTotal, 0, ',', '.')
                    ),
                ]);
            }

            if ($nonCashAmount > $grandTotal) {
                throw ValidationException::withMessages([
                    'payments' => 'Pembayaran non-tunai tidak boleh melebihi total tagihan (kembalian hanya berlaku untuk pembayaran tunai).',
                ]);
            }

            $changeAmount = round(max(0.0, $paidAmount - $grandTotal), 2);

            $uniqueMethods = array_values(array_unique(array_map(
                fn (array $p): string => $p['payment_method']->value,
                $normalizedPayments
            )));
            $legacyPaymentMethod = count($uniqueMethods) === 1 ? $uniqueMethods[0] : 'split';

            // 7. Generate invoice_number unik aman konkurensi
            $invoiceNumber = $this->generateInvoiceNumber();

            // 8. Simpan Transaction
            $transaction = Transaction::create([
                'invoice_number' => $invoiceNumber,
                'user_id' => $actor->id,
                'cashier_shift_id' => $lockedShift->id,
                'customer_id' => $data['customer_id'] ?? null,
                'subtotal' => $grossSubtotal,
                'discount_amount' => $totalDiscount,
                'tax_amount' => $taxAmount,
                'rounding_amount' => $roundingAmount,
                'total_amount' => $grossSubtotal,
                'discount' => $totalDiscount,
                'grand_total' => $grandTotal,
                'paid_amount' => $paidAmount,
                'pay_amount' => $paidAmount,
                'change_amount' => $changeAmount,
                'payment_method' => $legacyPaymentMethod,
                'status' => TransactionStatus::Completed,
                'discount_approved_by' => $discountApprovedBy,
            ]);

            // 9. Simpan TransactionDetail, potong stok produk, dan buat StockMovement
            foreach ($resolvedLines as $line) {
                /** @var Product $product */
                $product = $line['product'];
                $stockBefore = (int) $product->stock;
                $stockAfter = $stockBefore - $line['base_qty'];

                TransactionDetail::create([
                    'transaction_id' => $transaction->id,
                    'product_id' => $product->id,
                    'product_unit_id' => $line['product_unit_id'],
                    'unit_name_snapshot' => $line['unit_name_snapshot'],
                    'conversion_factor' => $line['conversion_factor'],
                    'qty' => $line['qty'],
                    'base_qty' => $line['base_qty'],
                    'unit_price' => $line['unit_price'],
                    'cost_price_snapshot' => $line['cost_price_snapshot'],
                    'discount_amount' => $line['discount_amount'],
                    'quantity' => (string) $line['base_qty'],
                    'buy_price' => $line['cost_price_snapshot'],
                    'sell_price' => $line['unit_price'],
                    'subtotal' => $line['subtotal'],
                ]);

                $product->stock = $stockAfter;
                $product->save();

                StockMovement::create([
                    'product_id' => $product->id,
                    'type' => StockMovementType::Sale,
                    'reference_type' => Transaction::class,
                    'reference_id' => $transaction->id,
                    'stock_before' => $stockBefore,
                    'qty_change' => -$line['base_qty'],
                    'stock_after' => $stockAfter,
                    'unit_cost' => $line['cost_price_snapshot'],
                    'notes' => "Penjualan POS {$invoiceNumber} ({$line['qty']} {$line['unit_name_snapshot']})",
                    'created_by' => $actor->id,
                ]);
            }

            // 10. Simpan TransactionPayment & posting ke FinanceService (netto tunai dikurangi change_amount)
            $remainingChange = $changeAmount;
            foreach ($normalizedPayments as $paymentRow) {
                $payment = TransactionPayment::create([
                    'transaction_id' => $transaction->id,
                    'payment_method' => $paymentRow['payment_method'],
                    'financial_account_id' => $paymentRow['financial_account_id'],
                    'amount' => $paymentRow['amount'],
                    'reference_number' => $paymentRow['reference_number'],
                ]);

                $netAmount = $paymentRow['amount'];
                if ($paymentRow['payment_method'] === PaymentMethod::Cash && $remainingChange > 0) {
                    $deduct = min($netAmount, $remainingChange);
                    $netAmount = round($netAmount - $deduct, 2);
                    $remainingChange = round($remainingChange - $deduct, 2);
                }

                if ($netAmount > 0) {
                    $this->financeService->recordPosSalePayment($transaction, $payment, $netAmount, $actor);
                }
            }

            // 11. Hapus HeldTransaction jika checkout berasal dari hold bill
            if (! empty($data['held_transaction_id'])) {
                HeldTransaction::query()
                    ->where('id', (int) $data['held_transaction_id'])
                    ->where('cashier_shift_id', $lockedShift->id)
                    ->delete();
            }

            // 12. Catat Spatie Activity Log
            activity(ActivityLogCategory::Transaction->value)
                ->event('created')
                ->performedOn($transaction)
                ->causedBy($actor)
                ->withProperties([
                    'invoice_number' => $transaction->invoice_number,
                    'shift_number' => $lockedShift->shift_number,
                    'items_count' => count($resolvedLines),
                    'subtotal' => $grossSubtotal,
                    'discount_amount' => $totalDiscount,
                    'tax_amount' => $taxAmount,
                    'rounding_amount' => $roundingAmount,
                    'grand_total' => $grandTotal,
                    'paid_amount' => $paidAmount,
                    'change_amount' => $changeAmount,
                    'payment_method' => $legacyPaymentMethod,
                    'discount_approved_by' => $discountApprovedBy,
                ])
                ->log(sprintf(
                    'Transaksi %s berhasil diproses sebesar Rp %s (%d item).',
                    $transaction->invoice_number,
                    number_format($grandTotal, 0, ',', '.'),
                    count($resolvedLines)
                ));

            return $transaction->load([
                'user:id,name,role',
                'cashierShift:id,shift_number,register_name',
                'customer:id,name,phone',
                'details.product:id,name,barcode,base_unit',
                'payments.financialAccount:id,code,name,type',
            ]);
        });
    }

    /**
     * Membatalkan (Void) transaksi yang berstatus completed dengan PIN Supervisor/Admin.
     *
     * @param  array{reason: string, supervisor_pin: string}  $data
     */
    public function void(Transaction $transaction, array $data, User $actor): Transaction
    {
        $approver = $this->supervisorPinService->verify(
            $data['supervisor_pin'],
            'PIN Supervisor / Admin wajib diisi untuk melakukan Void transaksi.'
        );

        return DB::transaction(function () use ($transaction, $data, $actor, $approver): Transaction {
            /** @var Transaction $lockedTx */
            $lockedTx = Transaction::query()
                ->where('id', $transaction->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedTx->status !== TransactionStatus::Completed) {
                throw ValidationException::withMessages([
                    'status' => "Transaksi {$lockedTx->invoice_number} berstatus {$lockedTx->status->label()} sehingga tidak dapat di-void.",
                ]);
            }

            $lockedTx->load(['details', 'payments']);

            // 1. Kunci produk secara terurut & kembalikan stok
            $productIds = $lockedTx->details->pluck('product_id')->unique()->sort()->values()->all();
            /** @var EloquentCollection<int, Product> $lockedProducts */
            $lockedProducts = Product::query()
                ->whereIn('id', $productIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            foreach ($lockedTx->details as $detail) {
                /** @var Product|null $product */
                $product = $lockedProducts->get($detail->product_id);
                if (! $product instanceof Product) {
                    continue;
                }

                $restoreBaseQty = $detail->base_qty > 0 ? $detail->base_qty : max(1, (int) $detail->quantity);
                $stockBefore = (int) $product->stock;
                $stockAfter = $stockBefore + $restoreBaseQty;

                $product->stock = $stockAfter;
                $product->save();

                StockMovement::create([
                    'product_id' => $product->id,
                    'type' => StockMovementType::SaleVoid,
                    'reference_type' => Transaction::class,
                    'reference_id' => $lockedTx->id,
                    'stock_before' => $stockBefore,
                    'qty_change' => $restoreBaseQty,
                    'stock_after' => $stockAfter,
                    'unit_cost' => (float) $detail->cost_price_snapshot > 0 ? $detail->cost_price_snapshot : $detail->buy_price,
                    'notes' => "Void Transaksi {$lockedTx->invoice_number}: ".trim($data['reason']),
                    'created_by' => $actor->id,
                ]);
            }

            // 2. Balikkan dana pada masing-masing akun pembayaran asal
            $remainingChange = round((float) ($lockedTx->change_amount ?? 0), 2);
            foreach ($lockedTx->payments as $payment) {
                $netAmount = round((float) $payment->amount, 2);
                if ($payment->payment_method === PaymentMethod::Cash && $remainingChange > 0) {
                    $deduct = min($netAmount, $remainingChange);
                    $netAmount = round($netAmount - $deduct, 2);
                    $remainingChange = round($remainingChange - $deduct, 2);
                }

                if ($netAmount > 0) {
                    $this->financeService->recordPosVoidReversal($lockedTx, $payment, $netAmount, $actor);
                }
            }

            // 3. Perbarui status transaksi menjadi voided
            $reason = trim($data['reason']);
            $lockedTx->update([
                'status' => TransactionStatus::Voided,
                'voided_by' => $approver->id,
                'voided_at' => now(),
                'void_reason' => $reason,
            ]);

            // 4. Catat Activity Log
            activity(ActivityLogCategory::Transaction->value)
                ->event('voided')
                ->performedOn($lockedTx)
                ->causedBy($actor)
                ->withProperties([
                    'invoice_number' => $lockedTx->invoice_number,
                    'old_status' => TransactionStatus::Completed->value,
                    'new_status' => TransactionStatus::Voided->value,
                    'grand_total' => (float) $lockedTx->grand_total,
                    'void_reason' => $reason,
                    'approved_by' => $approver->name,
                ])
                ->log(sprintf(
                    'Transaksi %s sebesar Rp %s dibatalkan (Void) oleh %s (Disetujui: %s). Alasan: %s',
                    $lockedTx->invoice_number,
                    number_format((float) $lockedTx->grand_total, 0, ',', '.'),
                    $actor->name,
                    $approver->name,
                    $reason
                ));

            return $lockedTx->fresh([
                'user:id,name,role',
                'voidedByUser:id,name,role',
                'details.product:id,name,barcode,base_unit',
                'payments.financialAccount:id,code,name,type',
            ]) ?? $lockedTx;
        });
    }

    /**
     * Menahan keranjang sementara (Hold Bill) tanpa membentuk nomor invoice resmi.
     *
     * @param  array{
     *     label?: string|null,
     *     customer_id?: int|null,
     *     discount_amount?: float|int|string|null,
     *     notes?: string|null,
     *     items: array<int, array{product_id: int, product_unit_id?: int|null, qty: int, discount_amount?: float|int|string|null}>
     * }  $data
     */
    public function hold(User $actor, array $data): HeldTransaction
    {
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($actor);

        if (! $activeShift instanceof CashierShift) {
            throw ValidationException::withMessages([
                'shift' => 'Anda harus memiliki sesi shift aktif untuk menahan transaksi.',
            ]);
        }

        return DB::transaction(function () use ($actor, $activeShift, $data): HeldTransaction {
            $holdCode = $this->generateHoldCode();

            $payload = [
                'items' => array_values(array_map(fn (array $item): array => [
                    'product_id' => (int) $item['product_id'],
                    'product_unit_id' => isset($item['product_unit_id']) ? (int) $item['product_unit_id'] : null,
                    'qty' => (int) $item['qty'],
                    'discount_amount' => round(max(0.0, (float) ($item['discount_amount'] ?? 0)), 2),
                ], $data['items'])),
                'discount_amount' => round(max(0.0, (float) ($data['discount_amount'] ?? 0)), 2),
                'notes' => isset($data['notes']) ? trim((string) $data['notes']) : null,
            ];

            return HeldTransaction::create([
                'hold_code' => $holdCode,
                'label' => isset($data['label']) && trim((string) $data['label']) !== ''
                    ? trim((string) $data['label'])
                    : null,
                'user_id' => $actor->id,
                'cashier_shift_id' => $activeShift->id,
                'customer_id' => $data['customer_id'] ?? null,
                'payload' => $payload,
            ]);
        });
    }

    /**
     * Daftar Hold Bill pada shift aktif pengguna, diperkaya data produk terkini agar siap di-resume.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listHeld(User $actor): array
    {
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($actor);
        if (! $activeShift instanceof CashierShift) {
            return [];
        }

        /** @var EloquentCollection<int, HeldTransaction> $heldRows */
        $heldRows = HeldTransaction::query()
            ->where('cashier_shift_id', $activeShift->id)
            ->with(['customer:id,name,phone'])
            ->latest('id')
            ->get();

        $allProductIds = [];
        foreach ($heldRows as $row) {
            $items = is_array($row->payload['items'] ?? null) ? $row->payload['items'] : [];
            foreach ($items as $item) {
                if (isset($item['product_id'])) {
                    $allProductIds[] = (int) $item['product_id'];
                }
            }
        }
        $allProductIds = array_values(array_unique($allProductIds));

        /** @var EloquentCollection<int, Product> $productsMap */
        $productsMap = ! empty($allProductIds)
            ? Product::query()
                ->whereIn('id', $allProductIds)
                ->with(['units' => fn ($q) => $q->where('is_active', true)->orderBy('conversion_factor')])
                ->get()
                ->keyBy('id')
            : new EloquentCollection;

        return $heldRows->map(function (HeldTransaction $held) use ($productsMap): array {
            $rawItems = is_array($held->payload['items'] ?? null) ? $held->payload['items'] : [];
            $enrichedItems = [];
            $estimatedTotal = 0.0;

            foreach ($rawItems as $item) {
                $pid = (int) ($item['product_id'] ?? 0);
                /** @var Product|null $product */
                $product = $productsMap->get($pid);
                if (! $product instanceof Product) {
                    continue;
                }

                $unitId = isset($item['product_unit_id']) ? (int) $item['product_unit_id'] : null;
                $qty = max(1, (int) ($item['qty'] ?? 1));
                $discount = round(max(0.0, (float) ($item['discount_amount'] ?? 0)), 2);

                /** @var ProductUnit|null $matchedUnit */
                $matchedUnit = $unitId !== null ? $product->units->firstWhere('id', $unitId) : null;
                $unitPrice = $matchedUnit instanceof ProductUnit
                    ? round((float) $matchedUnit->sell_price, 2)
                    : round((float) $product->sell_price, 2);

                $estimatedTotal += max(0.0, ($unitPrice * $qty) - $discount);

                $enrichedItems[] = [
                    'product' => $this->formatProductLookupRow($product, $unitId),
                    'product_unit_id' => $matchedUnit instanceof ProductUnit ? $matchedUnit->id : null,
                    'qty' => $qty,
                    'discount_amount' => $discount,
                ];
            }

            return [
                'id' => $held->id,
                'hold_code' => $held->hold_code,
                'label' => $held->label,
                'customer_id' => $held->customer_id,
                'customer_name' => $held->customer?->name,
                'discount_amount' => round((float) ($held->payload['discount_amount'] ?? 0), 2),
                'notes' => $held->payload['notes'] ?? null,
                'items_count' => count($enrichedItems),
                'estimated_total' => round(max(0.0, $estimatedTotal - (float) ($held->payload['discount_amount'] ?? 0)), 2),
                'items' => $enrichedItems,
                'created_at' => $held->created_at?->format('d M Y H:i') ?? '-',
                'created_at_human' => $held->created_at?->diffForHumans() ?? '-',
            ];
        })->values()->all();
    }

    public function deleteHeld(User $actor, HeldTransaction $heldTransaction): void
    {
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($actor);

        if (
            ! $actor->hasRoles([UserRoles::Admin, UserRoles::Supervisor])
            && ($activeShift === null || $heldTransaction->cashier_shift_id !== $activeShift->id)
        ) {
            throw ValidationException::withMessages([
                'held' => 'Anda tidak memiliki izin untuk menghapus transaksi tertahan ini.',
            ]);
        }

        $heldTransaction->delete();
    }

    /**
     * @return array{
     *     id: int,
     *     barcode: string,
     *     name: string,
     *     base_unit: string,
     *     sell_price: float,
     *     stock: int,
     *     image: string|null,
     *     matched_unit_id: int|null,
     *     units: array<int, array{id: int, unit_name: string, conversion_factor: int, barcode: string|null, sell_price: float}>
     * }
     */
    private function formatProductLookupRow(Product $product, ?int $matchedUnitId): array
    {
        return [
            'id' => $product->id,
            'barcode' => $product->barcode,
            'name' => $product->name,
            'base_unit' => $product->base_unit ?: 'pcs',
            'sell_price' => round((float) $product->sell_price, 2),
            'stock' => (int) $product->stock,
            'image' => $product->image,
            'matched_unit_id' => $matchedUnitId,
            'units' => $product->units->map(fn (ProductUnit $unit): array => [
                'id' => $unit->id,
                'unit_name' => $unit->unit_name,
                'conversion_factor' => (int) $unit->conversion_factor,
                'barcode' => $unit->barcode,
                'sell_price' => round((float) $unit->sell_price, 2),
            ])->values()->all(),
        ];
    }

    private function generateInvoiceNumber(): string
    {
        $dateStr = now()->format('Ymd');
        $prefix = "INV-{$dateStr}-";

        $latest = Transaction::query()
            ->where('invoice_number', 'like', "{$prefix}%")
            ->orderByDesc('invoice_number')
            ->lockForUpdate()
            ->value('invoice_number');

        $nextNumber = $latest ? ((int) substr((string) $latest, strlen($prefix)) + 1) : 1;

        return sprintf('%s%04d', $prefix, $nextNumber);
    }

    private function generateHoldCode(): string
    {
        $prefix = 'HOLD-';
        $latest = HeldTransaction::query()
            ->where('hold_code', 'like', "{$prefix}%")
            ->orderByDesc('id')
            ->lockForUpdate()
            ->value('hold_code');

        $nextNumber = $latest ? ((int) substr((string) $latest, strlen($prefix)) + 1) : 1;

        return sprintf('%s%04d', $prefix, $nextNumber);
    }
}
