<?php

namespace App\Http\Controllers;

use App\Enums\CashierShiftStatus;
use App\Http\Requests\StoreCashRegisterRequest;
use App\Http\Requests\UpdateCashRegisterRequest;
use App\Models\CashRegister;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CashRegisterController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', CashRegister::class);

        $likeOperator = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';

        $filters = $request->only([
            'search',
            'status',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);
        $perPage = $request->integer('per_page', 10);

        $allowedTableSorts = ['code', 'name', 'location', 'shifts_count', 'is_active'];
        $allowedToolbarSorts = ['code', 'name', 'location', 'shifts_count', 'is_active', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedTableSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedToolbarSorts, true);

        $query = CashRegister::query()
            ->with(['activeShift.user:id,name'])
            ->withCount('shifts')
            ->when($request->filled('search'), function ($query) use ($request, $likeOperator): void {
                $search = trim((string) $request->input('search'));
                $query->where(function ($q) use ($search, $likeOperator): void {
                    $q->where('code', $likeOperator, "%{$search}%")
                        ->orWhere('name', $likeOperator, "%{$search}%")
                        ->orWhere('location', $likeOperator, "%{$search}%")
                        ->orWhere('description', $likeOperator, "%{$search}%");
                });
            })
            ->when($request->filled('status') && $request->input('status') !== 'all', function ($query) use ($request): void {
                match ($request->input('status')) {
                    'active' => $query->where('is_active', true),
                    'inactive' => $query->where('is_active', false),
                    'in_use' => $query->whereHas('activeShift'),
                    'available' => $query->where('is_active', true)->whereDoesntHave('activeShift'),
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
            $query->orderBy('code', 'asc')->orderBy('id', 'asc');
        } elseif (($hasTableSort && $tableSort !== 'created_at') && (! $hasToolbarSort || $toolbarSort !== 'created_at')) {
            $query->orderBy('id', 'asc');
        }

        $user = $request->user();

        $cashRegisters = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (CashRegister $register): array => [
                'id' => $register->id,
                'code' => $register->code,
                'name' => $register->name,
                'location' => $register->location,
                'description' => $register->description,
                'is_active' => (bool) $register->is_active,
                'shifts_count' => (int) ($register->shifts_count ?? 0),
                'is_in_use' => $register->activeShift !== null,
                'active_shift' => $register->activeShift ? [
                    'id' => $register->activeShift->id,
                    'shift_number' => $register->activeShift->shift_number,
                    'cashier_name' => $register->activeShift->user?->name ?? '-',
                    'opened_at' => $register->activeShift->opened_at->format('d M Y H:i'),
                ] : null,
                'created_at' => $register->created_at?->format('d M Y'),
            ]);

        $openStatus = CashierShiftStatus::Open->value;
        $summaryRow = CashRegister::query()
            ->selectRaw(
                'COUNT(*) as total_registers,
                COUNT(*) FILTER (WHERE is_active = true) as active_registers,
                COUNT(*) FILTER (WHERE is_active = false) as inactive_registers,
                COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM cashier_shifts WHERE cashier_shifts.cash_register_id = cash_registers.id AND cashier_shifts.status = ?)) as in_use_registers',
                [$openStatus]
            )
            ->first();

        $activeRegisters = (int) ($summaryRow->active_registers ?? 0);
        $inUseRegisters = (int) ($summaryRow->in_use_registers ?? 0);

        $summary = [
            'total_registers' => (int) ($summaryRow->total_registers ?? 0),
            'active_registers' => $activeRegisters,
            'inactive_registers' => (int) ($summaryRow->inactive_registers ?? 0),
            'in_use_registers' => $inUseRegisters,
            'available_registers' => max(0, $activeRegisters - $inUseRegisters),
        ];

        return Inertia::render('POS/CashRegisters/CashRegister', [
            'cashRegisters' => $cashRegisters,
            'filters' => $filters,
            'summary' => $summary,
            'permissions' => [
                'can_create' => $user ? $user->can('create', CashRegister::class) : false,
                'can_edit' => $user ? $user->can('update', new CashRegister) : false,
                'can_delete' => $user ? $user->can('delete', new CashRegister) : false,
            ],
        ]);
    }

    public function store(StoreCashRegisterRequest $request): RedirectResponse
    {
        CashRegister::create($request->validated());

        return back()->with('success', 'Kasir fisik berhasil ditambahkan.');
    }

    public function update(UpdateCashRegisterRequest $request, CashRegister $cashRegister): RedirectResponse
    {
        $data = $request->validated();

        if (! $data['is_active'] && $cashRegister->activeShift()->exists()) {
            $activeShift = $cashRegister->activeShift()->with('user:id,name')->first();
            $cashierName = $activeShift?->user?->name ?? 'Kasir';

            return back()->withErrors([
                'is_active' => "Kasir fisik {$cashRegister->name} tidak dapat dinonaktifkan karena sedang digunakan oleh {$cashierName} ({$activeShift?->shift_number}).",
            ]);
        }

        $cashRegister->update($data);

        return back()->with('success', 'Data kasir fisik berhasil diperbarui.');
    }

    public function destroy(CashRegister $cashRegister): RedirectResponse
    {
        Gate::authorize('delete', $cashRegister);

        if ($cashRegister->activeShift()->exists()) {
            $activeShift = $cashRegister->activeShift()->with('user:id,name')->first();
            $cashierName = $activeShift?->user?->name ?? 'Kasir';

            return back()->with('error', "Kasir fisik {$cashRegister->name} tidak dapat dihapus karena sedang digunakan oleh {$cashierName} ({$activeShift?->shift_number}).");
        }

        $cashRegister->delete();

        return back()->with('success', 'Kasir fisik berhasil dihapus.');
    }
}
