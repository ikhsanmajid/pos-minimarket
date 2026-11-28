<?php

namespace App\Services;

use App\Enums\TransactionStatus;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;

class CustomerService
{
    /**
     * Normalisasi nomor HP: hapus spasi, strip, titik, dan tanda kurung berlebih.
     */
    public static function normalizePhone(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }

        $trimmed = trim($phone);
        if ($trimmed === '') {
            return null;
        }

        $hasLeadingPlus = str_starts_with($trimmed, '+');
        $digitsOnly = preg_replace('/[^0-9]/', '', $trimmed) ?? '';

        if ($digitsOnly === '') {
            return null;
        }

        return $hasLeadingPlus ? '+'.$digitsOnly : $digitsOnly;
    }

    /**
     * Generate member_code unik dengan format MBR-YYYYMMDD-XXXX.
     */
    public function generateMemberCode(): string
    {
        $datePrefix = 'MBR-'.now()->format('Ymd').'-';

        $latestCode = Customer::withTrashed()
            ->where('member_code', 'like', "{$datePrefix}%")
            ->orderByDesc('member_code')
            ->value('member_code');

        $nextSequence = 1;
        if (is_string($latestCode) && strlen($latestCode) > strlen($datePrefix)) {
            $nextSequence = ((int) substr($latestCode, strlen($datePrefix))) + 1;
        }

        do {
            $candidate = sprintf('%s%04d', $datePrefix, $nextSequence);
            $exists = Customer::withTrashed()->where('member_code', $candidate)->exists();
            $nextSequence++;
        } while ($exists);

        return $candidate;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, User $actor): Customer
    {
        return DB::transaction(function () use ($data, $actor): Customer {
            $memberCode = isset($data['member_code']) && trim((string) $data['member_code']) !== ''
                ? strtoupper(trim((string) $data['member_code']))
                : $this->generateMemberCode();

            $phone = self::normalizePhone(isset($data['phone']) ? (string) $data['phone'] : null);
            $email = isset($data['email']) && trim((string) $data['email']) !== ''
                ? strtolower(trim((string) $data['email']))
                : null;

            /** @var Customer $customer */
            $customer = Customer::create([
                'member_code' => $memberCode,
                'name' => trim((string) $data['name']),
                'phone' => $phone,
                'email' => $email,
                'address' => isset($data['address']) && trim((string) $data['address']) !== ''
                    ? trim((string) $data['address'])
                    : null,
                'points' => max(0, (int) ($data['points'] ?? 0)),
                'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true,
                'notes' => isset($data['notes']) && trim((string) $data['notes']) !== ''
                    ? trim((string) $data['notes'])
                    : null,
            ]);

            if (auth()->id() !== $actor->id) {
                $customer->activities()->latest('id')->first()?->update([
                    'causer_type' => User::class,
                    'causer_id' => $actor->id,
                ]);
            }

            return $customer;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Customer $customer, array $data, User $actor): Customer
    {
        return DB::transaction(function () use ($customer, $data, $actor): Customer {
            $payload = [
                'name' => trim((string) $data['name']),
                'phone' => self::normalizePhone(isset($data['phone']) ? (string) $data['phone'] : null),
                'email' => isset($data['email']) && trim((string) $data['email']) !== ''
                    ? strtolower(trim((string) $data['email']))
                    : null,
                'address' => isset($data['address']) && trim((string) $data['address']) !== ''
                    ? trim((string) $data['address'])
                    : null,
                'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : $customer->is_active,
                'notes' => isset($data['notes']) && trim((string) $data['notes']) !== ''
                    ? trim((string) $data['notes'])
                    : null,
            ];

            if (isset($data['member_code']) && trim((string) $data['member_code']) !== '') {
                $payload['member_code'] = strtoupper(trim((string) $data['member_code']));
            }

            if (array_key_exists('points', $data) && $data['points'] !== null) {
                $payload['points'] = max(0, (int) $data['points']);
            }

            $customer->update($payload);

            if (auth()->id() !== $actor->id) {
                $customer->activities()->latest('id')->first()?->update([
                    'causer_type' => User::class,
                    'causer_id' => $actor->id,
                ]);
            }

            return $customer->refresh();
        });
    }

    public function delete(Customer $customer, User $actor): void
    {
        DB::transaction(function () use ($customer, $actor): void {
            $customer->delete();

            if (auth()->id() !== $actor->id) {
                $customer->activities()->latest('id')->first()?->update([
                    'causer_type' => User::class,
                    'causer_id' => $actor->id,
                ]);
            }
        });
    }

    /**
     * Pencarian cepat pelanggan aktif untuk autocomplete Terminal Kasir POS.
     *
     * @return EloquentCollection<int, Customer>
     */
    public function searchForPos(string $query, int $limit = 15): EloquentCollection
    {
        $term = trim($query);
        $normalizedPhoneTerm = self::normalizePhone($term);
        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        return Customer::query()
            ->active()
            ->when($term !== '', function ($builder) use ($term, $normalizedPhoneTerm, $likeOperator): void {
                $builder->where(function ($sub) use ($term, $normalizedPhoneTerm, $likeOperator): void {
                    $sub->where('name', $likeOperator, "%{$term}%")
                        ->orWhere('member_code', $likeOperator, "%{$term}%")
                        ->orWhere('phone', $likeOperator, "%{$term}%");

                    if ($normalizedPhoneTerm !== null && $normalizedPhoneTerm !== $term) {
                        $sub->orWhere('phone', $likeOperator, "%{$normalizedPhoneTerm}%");
                    }
                });
            })
            ->orderBy('name')
            ->limit(max(1, min($limit, 30)))
            ->get(['id', 'member_code', 'name', 'phone', 'points']);
    }

    /**
     * Hitung 4 metrik KPI pelanggan dalam 1 query agregasi PostgreSQL.
     *
     * @return array{
     *     total_customers: int,
     *     active_customers: int,
     *     inactive_customers: int,
     *     new_this_month: int,
     *     transacted_customers: int,
     *     total_active_points: int
     * }
     */
    public function getSummary(): array
    {
        $monthStart = now()->startOfMonth()->toDateTimeString();

        $row = Customer::query()
            ->selectRaw(
                'COUNT(*) as total_customers,
                COUNT(*) FILTER (WHERE is_active = true) as active_customers,
                COUNT(*) FILTER (WHERE is_active = false) as inactive_customers,
                COUNT(*) FILTER (WHERE created_at >= ?) as new_this_month,
                COALESCE(SUM(points) FILTER (WHERE is_active = true), 0) as total_active_points,
                COUNT(*) FILTER (WHERE EXISTS (
                    SELECT 1 FROM transactions t
                    WHERE t.customer_id = customers.id
                      AND t.status != ?
                )) as transacted_customers',
                [
                    $monthStart,
                    TransactionStatus::Voided->value,
                ]
            )
            ->first();

        return [
            'total_customers' => (int) ($row->total_customers ?? 0),
            'active_customers' => (int) ($row->active_customers ?? 0),
            'inactive_customers' => (int) ($row->inactive_customers ?? 0),
            'new_this_month' => (int) ($row->new_this_month ?? 0),
            'transacted_customers' => (int) ($row->transacted_customers ?? 0),
            'total_active_points' => (int) ($row->total_active_points ?? 0),
        ];
    }

    /**
     * Statistik belanja pelanggan (mengecualikan transaksi voided).
     *
     * @return array{
     *     total_transactions: int,
     *     total_spent: float,
     *     average_spent: float,
     *     last_visit_at: string|null
     * }
     */
    public function getDetailStats(Customer $customer): array
    {
        $row = Transaction::query()
            ->where('customer_id', $customer->id)
            ->where('status', '!=', TransactionStatus::Voided->value)
            ->selectRaw(
                'COUNT(*) as total_transactions,
                COALESCE(SUM(grand_total), 0) as total_spent,
                MAX(created_at) as last_visit_at'
            )
            ->first();

        $totalTransactions = (int) ($row->total_transactions ?? 0);
        $totalSpent = round((float) ($row->total_spent ?? 0), 2);
        $averageSpent = $totalTransactions > 0 ? round($totalSpent / $totalTransactions, 2) : 0.0;
        $lastVisitRaw = $row->last_visit_at ?? null;
        $lastVisitFormatted = $lastVisitRaw !== null
            ? now()->parse((string) $lastVisitRaw)->format('d M Y H:i')
            : null;

        return [
            'total_transactions' => $totalTransactions,
            'total_spent' => $totalSpent,
            'average_spent' => $averageSpent,
            'last_visit_at' => $lastVisitFormatted,
        ];
    }
}
