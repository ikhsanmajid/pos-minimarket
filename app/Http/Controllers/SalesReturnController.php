<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSalesReturnRequest;
use App\Models\SalesReturn;
use App\Models\Transaction;
use App\Models\User;
use App\Services\SalesReturnService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

class SalesReturnController extends Controller
{
    public function __construct(public SalesReturnService $salesReturnService) {}

    public function store(StoreSalesReturnRequest $request, Transaction $transaction): RedirectResponse
    {
        Gate::authorize('returnItems', $transaction);
        Gate::authorize('create', SalesReturn::class);

        /** @var User $user */
        $user = $request->user();

        /** @var array{
         *     refund_method: string,
         *     financial_account_id: int,
         *     reason: string,
         *     supervisor_pin: string,
         *     items: array<int, array{transaction_detail_id: int, qty: int, is_restockable: bool}>
         * } $validated */
        $validated = $request->validated();

        $salesReturn = $this->salesReturnService->processReturn($transaction, $validated, $user);

        return back()->with('success', "Retur {$salesReturn->return_number} berhasil diproses.");
    }
}
