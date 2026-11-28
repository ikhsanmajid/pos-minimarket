<?php

namespace App\Http\Controllers;

use App\Enums\ActivityLogCategory;
use App\Enums\UserRoles;
use App\Models\Category;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class ActivityLogController extends Controller
{
    public function index(Request $request): Response
    {
        if (! $request->user()?->hasRoles(UserRoles::Admin)) {
            abort(403, 'Akses tidak diizinkan.');
        }

        $filters = $request->only([
            'search',
            'log_name',
            'subject_type',
            'date_from',
            'date_to',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);
        $perPage = $request->integer('per_page', 15);

        // Sorting definitions
        $allowedTableSorts = ['id', 'created_at', 'log_name', 'description'];
        $allowedToolbarSorts = ['id', 'created_at', 'log_name', 'description'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedTableSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedToolbarSorts, true);

        $categoryEnum = ActivityLogCategory::tryFrom((string) $request->log_name);

        $query = Activity::query()
            ->with(['causer', 'subject'])
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('description', 'ilike', "%{$search}%")
                        ->orWhereHasMorph('causer', [User::class], function ($subQ) use ($search) {
                            $subQ->where('name', 'ilike', "%{$search}%")
                                ->orWhere('email', 'ilike', "%{$search}%");
                        });
                });
            })
            ->when($request->filled('log_name') && $request->log_name !== 'all', function ($query) use ($request, $categoryEnum) {
                $val = $request->log_name;
                $modelClass = $categoryEnum?->modelClass();

                if ($modelClass) {
                    $query->where(function ($q) use ($val, $modelClass) {
                        $q->where('log_name', $val)
                            ->orWhere(fn ($sub) => $sub->where('log_name', 'default')->where('subject_type', $modelClass));
                    });
                } else {
                    $query->where('log_name', $val);
                }
            })
            ->when($request->filled('subject_type') && $request->subject_type !== 'all', function ($query) use ($request) {
                $query->where('subject_type', $request->subject_type);
            })
            ->when($request->filled('date_from'), function ($query) use ($request) {
                $query->whereDate('created_at', '>=', $request->date_from);
            })
            ->when($request->filled('date_to'), function ($query) use ($request) {
                $query->whereDate('created_at', '<=', $request->date_to);
            });

        // Multi-column sorting
        if ($hasTableSort) {
            $query->orderBy($tableSort, $tableDirection);
        }

        if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
            $query->orderBy($toolbarSort, $toolbarDirection);
        }

        if (! $hasTableSort && ! $hasToolbarSort) {
            $query->latest('id');
        } elseif (($hasTableSort && $tableSort !== 'id') && (! $hasToolbarSort || $toolbarSort !== 'id')) {
            $query->orderBy('id', 'desc');
        }

        $paginatedActivities = $query->paginate($perPage)->withQueryString();

        $categoryIds = collect($paginatedActivities->items())
            ->flatMap(function (Activity $act) {
                $changes = $act->attribute_changes?->toArray() ?? [];
                $props = $act->properties?->toArray() ?? [];
                $old = $changes['old'] ?? $props['old'] ?? [];
                $new = $changes['attributes'] ?? $props['attributes'] ?? [];

                return array_filter([$old['category_id'] ?? null, $new['category_id'] ?? null]);
            })
            ->unique()
            ->filter()
            ->values();

        $categoryMap = Category::withTrashed()
            ->whereIn('id', $categoryIds)
            ->pluck('name', 'id')
            ->all();

        $activities = $paginatedActivities->through(fn (Activity $act) => [
            'id' => $act->id,
            'log_name' => $act->log_name,
            'log_name_label' => ActivityLogCategory::resolveLabel($act->log_name, $act->subject_type),
            'description' => $this->resolveDescription($act),
            'event' => $act->event,
            'subject_type' => $act->subject_type ? class_basename($act->subject_type) : null,
            'subject_type_full' => $act->subject_type,
            'subject_id' => $act->subject_id,
            'causer_name' => $act->causer instanceof User ? $act->causer->name : 'Sistem',
            'causer_role' => $act->causer instanceof User ? ($act->causer->role?->label() ?? $act->causer->role?->value) : null,
            'properties' => $act->properties?->toArray() ?? [],
            'attribute_changes' => $act->attribute_changes?->toArray() ?? [],
            'category_map' => $categoryMap,
            'created_at' => $act->created_at?->format('d M Y H:i:s'),
            'created_at_human' => $act->created_at?->diffForHumans(),
        ]);

        // Hitung statistik kategori log secara terpusat berdasarkan ActivityLogCategory Enum
        $defaultModules = Activity::where('log_name', 'default')
            ->whereNotNull('subject_type')
            ->distinct()
            ->pluck('subject_type')
            ->all();

        $logNames = collect(ActivityLogCategory::cases())
            ->filter(fn (ActivityLogCategory $cat) => $cat !== ActivityLogCategory::Default)
            ->map(function (ActivityLogCategory $cat) {
                $modelClass = $cat->modelClass();
                $modules = $modelClass ? [$modelClass] : [];
                if ($cat === ActivityLogCategory::Auth) {
                    $modules = [User::class];
                }

                $count = Activity::query()
                    ->when($modelClass, function ($q) use ($cat, $modelClass) {
                        $q->where('log_name', $cat->value)
                            ->orWhere(fn ($sub) => $sub->where('log_name', 'default')->where('subject_type', $modelClass));
                    }, fn ($q) => $q->where('log_name', $cat->value))
                    ->count();

                return [
                    'value' => $cat->value,
                    'label' => $cat->label(),
                    'short_label' => $cat->shortLabel(),
                    'count' => $count,
                    'modules' => $modules,
                ];
            })
            ->values();

        // Sertakan kategori default hanya jika ada aktivitas umum yang belum dipetakan
        if (! empty($defaultModules)) {
            $otherDefaultCount = Activity::where('log_name', 'default')->count();
            if ($otherDefaultCount > 0) {
                $logNames->push([
                    'value' => 'default',
                    'label' => ActivityLogCategory::Default->label(),
                    'short_label' => ActivityLogCategory::Default->shortLabel(),
                    'count' => $otherDefaultCount,
                    'modules' => $defaultModules,
                ]);
            }
        }

        $subjectTypes = Activity::select('subject_type')
            ->whereNotNull('subject_type')
            ->distinct()
            ->pluck('subject_type')
            ->map(fn (string $type) => [
                'value' => $type,
                'label' => match (class_basename($type)) {
                    'Product' => 'Produk',
                    'User' => 'Pengguna & Akun',
                    'Category' => 'Kategori Produk',
                    'Supplier' => 'Supplier',
                    'PurchaseOrder' => 'Purchase Order',
                    'PurchaseOrderReceipt' => 'Penerimaan Barang (LPB)',
                    'FinancialAccount' => 'Akun Keuangan',
                    'AccountPayable' => 'Hutang Dagang',
                    'PayablePayment' => 'Pembayaran Hutang',
                    'CashierShift' => 'Sesi Shift Kasir',
                    'ShiftCashMovement' => 'Mutasi Kas Shift',
                    'Transaction' => 'Transaksi Penjualan',
                    default => class_basename($type),
                },
            ])
            ->sortBy('label')
            ->values();

        return Inertia::render('POS/ActivityLogs/ActivityLog', [
            'activities' => $activities,
            'filters' => $filters,
            'logNames' => $logNames,
            'subjectTypes' => $subjectTypes,
            'categoryMap' => $categoryMap,
        ]);
    }

    /**
     * Format deskripsi aktivitas agar seragam dan deskriptif (termasuk untuk log lama yang hanya menyimpan nama event).
     */
    private function resolveDescription(Activity $activity): string
    {
        $rawDescription = trim((string) $activity->description);
        $normalized = strtolower($rawDescription);

        if (! in_array($normalized, ['created', 'updated', 'deleted', 'restored'], true)) {
            return $rawDescription;
        }

        $moduleLabel = match ($activity->subject_type ? class_basename($activity->subject_type) : null) {
            'Product' => 'Produk',
            'Category' => 'Kategori',
            'Supplier' => 'Supplier',
            'User' => 'Pengguna',
            'PurchaseOrder' => 'Purchase Order',
            'PurchaseOrderReceipt' => 'Penerimaan Barang',
            'FinancialAccount' => 'Akun Keuangan',
            'AccountPayable' => 'Hutang Dagang',
            'PayablePayment' => 'Pembayaran Hutang',
            'CashierShift' => 'Sesi Shift',
            'ShiftCashMovement' => 'Mutasi Kas Shift',
            'Transaction' => 'Transaksi',
            default => $activity->subject_type ? class_basename($activity->subject_type) : 'Data',
        };

        $changes = $activity->attribute_changes?->toArray() ?? [];
        $props = $activity->properties?->toArray() ?? [];
        $attributes = $changes['attributes'] ?? $props['attributes'] ?? [];
        $old = $changes['old'] ?? $props['old'] ?? [];

        $subject = $activity->subject;
        $identifier = $subject?->name
            ?? $subject?->po_number
            ?? $subject?->code
            ?? $attributes['name']
            ?? $old['name']
            ?? $attributes['po_number']
            ?? $old['po_number']
            ?? $props['po_number']
            ?? $attributes['code']
            ?? $old['code']
            ?? ($activity->subject_id ? "#{$activity->subject_id}" : '');

        $target = trim("{$moduleLabel} {$identifier}");

        return match ($normalized) {
            'created' => "{$target} berhasil dibuat.",
            'updated' => "{$target} diperbarui.",
            'deleted' => "{$target} dihapus.",
            'restored' => "{$target} dipulihkan.",
            default => $rawDescription,
        };
    }
}
