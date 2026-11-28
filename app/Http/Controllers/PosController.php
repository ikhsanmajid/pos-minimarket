<?php

namespace App\Http\Controllers;

use App\Enums\PaymentMethod;
use App\Enums\UserRoles;
use App\Http\Requests\CheckoutPosRequest;
use App\Http\Requests\HoldTransactionRequest;
use App\Models\Customer;
use App\Models\FinancialAccount;
use App\Models\HeldTransaction;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionPayment;
use App\Models\User;
use App\Services\CashierShiftService;
use App\Services\PosTransactionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PosController extends Controller
{
    public function __construct(
        public PosTransactionService $posTransactionService,
        public CashierShiftService $cashierShiftService,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('create', Transaction::class);

        /** @var User $user */
        $user = $request->user();
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($user);

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

        $paymentMethods = array_map(
            fn (PaymentMethod $method): array => [
                'value' => $method->value,
                'label' => $method->label(),
            ],
            [
                PaymentMethod::Cash,
                PaymentMethod::Qris,
                PaymentMethod::Debit,
                PaymentMethod::Transfer,
            ]
        );

        $customers = Customer::query()
            ->orderBy('name')
            ->limit(100)
            ->get(['id', 'name', 'phone'])
            ->map(fn (Customer $c): array => [
                'id' => $c->id,
                'name' => $c->name,
                'phone' => $c->phone,
            ])
            ->values()
            ->all();

        $donationProducts = Product::query()
            ->where('active', true)
            ->where('is_donation', true)
            ->orderBy('name')
            ->get(['id', 'barcode', 'name', 'base_unit', 'sell_price'])
            ->map(fn (Product $p): array => [
                'id' => $p->id,
                'barcode' => $p->barcode,
                'name' => $p->name,
                'base_unit' => $p->base_unit ?: 'pcs',
                'sell_price' => (float) $p->sell_price,
            ])
            ->values()
            ->all();

        return Inertia::render('POS/Cashier/Terminal', [
            'shiftSummary' => $activeShift ? [
                'id' => $activeShift->id,
                'shift_number' => $activeShift->shift_number,
                'register_name' => $activeShift->register_name,
                'opened_at' => $activeShift->opened_at->format('d M Y H:i'),
                'starting_cash' => (float) $activeShift->starting_cash,
                'transactions_count' => $activeShift->transactions()
                    ->whereIn('status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES)
                    ->count(),
            ] : null,
            'financialAccounts' => $financialAccounts,
            'paymentMethods' => $paymentMethods,
            'customers' => $customers,
            'donationProducts' => $donationProducts,
            'heldTransactions' => $this->posTransactionService->listHeld($user),
            'policyRules' => [
                'manual_discount_pin_threshold' => PosTransactionService::MANUAL_DISCOUNT_PIN_THRESHOLD,
                'is_privileged' => $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]),
            ],
        ]);
    }

    public function lookup(Request $request): JsonResponse
    {
        Gate::authorize('create', Transaction::class);

        $query = (string) $request->query('q', '');
        $limit = $request->integer('limit', 15);

        return response()->json([
            'products' => $this->posTransactionService->lookupProducts($query, $limit),
        ]);
    }

    public function checkout(CheckoutPosRequest $request): JsonResponse|RedirectResponse
    {
        Gate::authorize('create', Transaction::class);

        /** @var User $user */
        $user = $request->user();

        /** @var array{
         *     customer_id?: int|null,
         *     held_transaction_id?: int|null,
         *     discount_amount?: float|int|string|null,
         *     supervisor_pin?: string|null,
         *     items: array<int, array{product_id: int, product_unit_id?: int|null, qty: int, discount_amount?: float|int|string|null}>,
         *     payments: array<int, array{payment_method: string, financial_account_id: int, amount: float|int|string, reference_number?: string|null}>
         * } $validated */
        $validated = $request->validated();

        $transaction = $this->posTransactionService->checkout($user, $validated);
        $receiptPayload = self::formatReceiptPayload($transaction);

        if ($request->expectsJson() && ! $request->hasHeader('X-Inertia')) {
            return response()->json([
                'message' => "Transaksi {$transaction->invoice_number} berhasil diproses.",
                'transaction' => $receiptPayload,
            ], 201);
        }

        return redirect()->route('pos.cashier.index')
            ->with('success', "Transaksi {$transaction->invoice_number} berhasil diproses.")
            ->with('lastReceipt', $receiptPayload);
    }

    public function hold(HoldTransactionRequest $request): JsonResponse|RedirectResponse
    {
        Gate::authorize('create', Transaction::class);

        /** @var User $user */
        $user = $request->user();

        /** @var array{
         *     label?: string|null,
         *     customer_id?: int|null,
         *     discount_amount?: float|int|string|null,
         *     notes?: string|null,
         *     items: array<int, array{product_id: int, product_unit_id?: int|null, qty: int, discount_amount?: float|int|string|null}>
         * } $validated */
        $validated = $request->validated();

        $held = $this->posTransactionService->hold($user, $validated);

        if ($request->expectsJson() && ! $request->hasHeader('X-Inertia')) {
            return response()->json([
                'message' => "Transaksi berhasil ditahan ({$held->hold_code}).",
                'held' => $held,
                'heldTransactions' => $this->posTransactionService->listHeld($user),
            ], 201);
        }

        return back()->with('success', "Keranjang berhasil ditahan dengan kode {$held->hold_code}.");
    }

    public function heldList(Request $request): JsonResponse
    {
        Gate::authorize('create', Transaction::class);

        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'heldTransactions' => $this->posTransactionService->listHeld($user),
        ]);
    }

    public function deleteHeld(Request $request, HeldTransaction $heldTransaction): JsonResponse|RedirectResponse
    {
        Gate::authorize('create', Transaction::class);

        /** @var User $user */
        $user = $request->user();
        $code = $heldTransaction->hold_code;

        $this->posTransactionService->deleteHeld($user, $heldTransaction);

        if ($request->expectsJson() && ! $request->hasHeader('X-Inertia')) {
            return response()->json([
                'message' => "Transaksi tertahan {$code} dihapus.",
                'heldTransactions' => $this->posTransactionService->listHeld($user),
            ]);
        }

        return back()->with('success', "Transaksi tertahan {$code} berhasil dihapus.");
    }

    /**
     * Format data transaksi menjadi payload struk thermal siap cetak.
     *
     * @return array<string, mixed>
     */
    public static function formatReceiptPayload(Transaction $transaction): array
    {
        $transaction->loadMissing([
            'user:id,name',
            'cashierShift:id,shift_number,register_name',
            'customer:id,name,phone',
            'details.product:id,name,barcode,base_unit',
            'payments.financialAccount:id,code,name,type',
        ]);

        return [
            'id' => $transaction->id,
            'invoice_number' => $transaction->invoice_number,
            'status' => $transaction->status->value,
            'status_label' => $transaction->status->label(),
            'created_at' => $transaction->created_at?->format('d/m/Y H:i:s') ?? '-',
            'cashier_name' => $transaction->user?->name ?? '-',
            'register_name' => $transaction->cashierShift?->register_name ?? 'Kasir',
            'shift_number' => $transaction->cashierShift?->shift_number ?? '-',
            'customer_name' => $transaction->customer?->name,
            'subtotal' => (float) $transaction->subtotal,
            'discount_amount' => (float) $transaction->discount_amount,
            'tax_amount' => (float) $transaction->tax_amount,
            'rounding_amount' => (float) $transaction->rounding_amount,
            'donation_amount' => (float) $transaction->donation_amount,
            'grand_total' => (float) $transaction->grand_total,
            'paid_amount' => (float) $transaction->paid_amount,
            'change_amount' => (float) ($transaction->change_amount ?? 0),
            'items' => $transaction->details->map(fn (TransactionDetail $d): array => [
                'id' => $d->id,
                'product_name' => $d->product?->name ?? "Produk #{$d->product_id}",
                'unit_name' => $d->unit_name_snapshot ?: 'pcs',
                'qty' => $d->qty > 0 ? $d->qty : (int) $d->quantity,
                'unit_price' => (float) ((float) $d->unit_price > 0 ? $d->unit_price : $d->sell_price),
                'discount_amount' => (float) $d->discount_amount,
                'is_tax_exempt' => (bool) $d->is_tax_exempt,
                'is_donation' => (bool) $d->is_donation,
                'subtotal' => (float) $d->subtotal,
            ])->values()->all(),
            'payments' => $transaction->payments->map(fn (TransactionPayment $p): array => [
                'id' => $p->id,
                'payment_method' => $p->payment_method->value,
                'payment_method_label' => $p->payment_method->label(),
                'account_name' => $p->financialAccount?->name ?? '-',
                'amount' => (float) $p->amount,
                'reference_number' => $p->reference_number,
            ])->values()->all(),
        ];
    }
}
