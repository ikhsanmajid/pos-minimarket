<?php

namespace App\Http\Controllers;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Http\Requests\StorePayablePaymentRequest;
use App\Models\AccountPayable;
use App\Models\FinancialAccount;
use App\Models\Supplier;
use App\Services\FinanceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class AccountPayableController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', AccountPayable::class);

        $filters = $request->only([
            'search',
            'status',
            'due_filter',
            'supplier_id',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);
        $perPage = $request->integer('per_page', 10);

        $allowedSorts = ['payable_number', 'due_date', 'total_amount', 'paid_amount', 'remaining_amount', 'status', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $today = now()->toDateString();
        $nextWeek = now()->addDays(7)->toDateString();

        $query = AccountPayable::with(['purchaseOrder:id,po_number,status,receiving_status,payment_status', 'supplier:id,name,code'])
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('payable_number', 'ilike', "%{$search}%")
                        ->orWhere('invoice_number', 'ilike', "%{$search}%")
                        ->orWhereHas('purchaseOrder', fn ($poQ) => $poQ->where('po_number', 'ilike', "%{$search}%"))
                        ->orWhereHas('supplier', fn ($supQ) => $supQ->where('name', 'ilike', "%{$search}%"));
                });
            })
            ->when($request->status && $request->status !== 'all', function ($query) use ($request) {
                $query->where('status', $request->status);
            })
            ->when($request->supplier_id && $request->supplier_id !== 'all', function ($query) use ($request) {
                $query->where('supplier_id', $request->supplier_id);
            })
            ->when($request->due_filter && $request->due_filter !== 'all', function ($query) use ($request, $today, $nextWeek) {
                match ($request->due_filter) {
                    'overdue' => $query->where('status', '!=', PaymentStatus::Paid->value)
                        ->whereNotNull('due_date')
                        ->whereDate('due_date', '<', $today),
                    'due_soon' => $query->where('status', '!=', PaymentStatus::Paid->value)
                        ->whereNotNull('due_date')
                        ->whereDate('due_date', '>=', $today)
                        ->whereDate('due_date', '<=', $nextWeek),
                    'not_due' => $query->where('status', '!=', PaymentStatus::Paid->value)
                        ->where(fn ($q) => $q->whereNull('due_date')->orWhereDate('due_date', '>', $nextWeek)),
                    default => null,
                };
            });

        if ($hasTableSort) {
            $query->orderBy($tableSort, $tableDirection);
        }

        if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
            $query->orderBy($toolbarSort, $toolbarDirection);
        }

        if (! $hasTableSort && ! $hasToolbarSort) {
            $query->orderByRaw("CASE WHEN status = 'paid' THEN 1 ELSE 0 END ASC")
                ->orderByRaw('due_date ASC NULLS LAST')
                ->orderByDesc('id');
        }

        $user = $request->user();

        $payables = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (AccountPayable $ap) => [
                'id' => $ap->id,
                'payable_number' => $ap->payable_number,
                'purchase_order_id' => $ap->purchase_order_id,
                'po_number' => $ap->purchaseOrder?->po_number ?? '-',
                'supplier_id' => $ap->supplier_id,
                'supplier_name' => $ap->supplier?->name ?? '-',
                'invoice_number' => $ap->invoice_number,
                'total_amount' => (float) $ap->total_amount,
                'paid_amount' => (float) $ap->paid_amount,
                'remaining_amount' => (float) $ap->remaining_amount,
                'due_date' => $ap->due_date?->format('d M Y'),
                'raw_due_date' => $ap->due_date?->toDateString(),
                'is_overdue' => $ap->isOverdue(),
                'status' => $ap->status->value,
                'status_label' => $ap->status->label(),
                'can_pay' => $user ? $user->can('recordPayment', $ap) : false,
            ]);

        $summaryRow = AccountPayable::query()
            ->selectRaw(
                'COUNT(*) as total_count,
                COALESCE(SUM(total_amount), 0) as total_amount,
                COALESCE(SUM(paid_amount), 0) as paid_amount,
                COUNT(*) FILTER (WHERE status = ?) as paid_count,
                COALESCE(SUM(remaining_amount) FILTER (WHERE status != ?), 0) as total_outstanding,
                COUNT(*) FILTER (WHERE status != ?) as unpaid_count,
                COALESCE(SUM(remaining_amount) FILTER (WHERE status != ? AND remaining_amount > 0 AND due_date IS NOT NULL AND due_date < ?), 0) as overdue_amount,
                COUNT(*) FILTER (WHERE status != ? AND remaining_amount > 0 AND due_date IS NOT NULL AND due_date < ?) as overdue_count,
                COALESCE(SUM(remaining_amount) FILTER (WHERE status != ? AND remaining_amount > 0 AND due_date IS NOT NULL AND due_date >= ? AND due_date <= ?), 0) as due_soon_amount,
                COUNT(*) FILTER (WHERE status != ? AND remaining_amount > 0 AND due_date IS NOT NULL AND due_date >= ? AND due_date <= ?) as due_soon_count',
                [
                    PaymentStatus::Paid->value,
                    PaymentStatus::Paid->value,
                    PaymentStatus::Paid->value,
                    PaymentStatus::Paid->value,
                    $today,
                    PaymentStatus::Paid->value,
                    $today,
                    PaymentStatus::Paid->value,
                    $today,
                    $nextWeek,
                    PaymentStatus::Paid->value,
                    $today,
                    $nextWeek,
                ]
            )
            ->first();

        $summary = [
            'total_count' => (int) ($summaryRow->total_count ?? 0),
            'total_amount' => round((float) ($summaryRow->total_amount ?? 0), 2),
            'paid_amount' => round((float) ($summaryRow->paid_amount ?? 0), 2),
            'paid_count' => (int) ($summaryRow->paid_count ?? 0),
            'total_outstanding' => round((float) ($summaryRow->total_outstanding ?? 0), 2),
            'unpaid_count' => (int) ($summaryRow->unpaid_count ?? 0),
            'overdue_amount' => round((float) ($summaryRow->overdue_amount ?? 0), 2),
            'overdue_count' => (int) ($summaryRow->overdue_count ?? 0),
            'due_soon_amount' => round((float) ($summaryRow->due_soon_amount ?? 0), 2),
            'due_soon_count' => (int) ($summaryRow->due_soon_count ?? 0),
        ];

        $financialAccounts = FinancialAccount::where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'type', 'current_balance', 'is_default'])
            ->map(fn (FinancialAccount $acc) => [
                'id' => $acc->id,
                'code' => $acc->code,
                'name' => $acc->name,
                'type' => $acc->type->value,
                'type_label' => $acc->type->label(),
                'current_balance' => (float) $acc->current_balance,
                'is_default' => (bool) $acc->is_default,
            ]);

        $suppliers = Supplier::orderBy('name')->get(['id', 'name', 'code', 'is_active']);

        return Inertia::render('POS/Finance/AccountPayable', [
            'payables' => $payables,
            'filters' => $filters,
            'summary' => $summary,
            'suppliers' => $suppliers,
            'financialAccounts' => $financialAccounts,
            'paymentStatuses' => collect(PaymentStatus::cases())->map(fn ($s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ]),
            'paymentMethods' => collect(PaymentMethod::cases())->map(fn ($m) => [
                'value' => $m->value,
                'label' => $m->label(),
            ]),
        ]);
    }

    public function recordPayment(
        StorePayablePaymentRequest $request,
        AccountPayable $accountPayable,
        FinanceService $financeService
    ): RedirectResponse {
        $payment = $financeService->recordPayablePayment($accountPayable, $request->validated(), $request->user());

        return back()->with('success', "Pembayaran {$payment->payment_number} berhasil dicatat dan saldo kas/bank diperbarui.");
    }
}
