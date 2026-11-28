<?php

namespace App\Models;

use App\Enums\PointLedgerType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $customer_id
 * @property int|null $transaction_id
 * @property int|null $sales_return_id
 * @property PointLedgerType $type
 * @property int $points
 * @property int $remaining_points
 * @property Carbon|null $expires_at
 * @property string $description
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('customer_point_ledgers')]
#[Fillable([
    'customer_id',
    'transaction_id',
    'sales_return_id',
    'type',
    'points',
    'remaining_points',
    'expires_at',
    'description',
    'created_by',
])]
class CustomerPointLedger extends Model
{
    protected $attributes = [
        'remaining_points' => 0,
    ];

    protected function casts(): array
    {
        return [
            'type' => PointLedgerType::class,
            'points' => 'integer',
            'remaining_points' => 'integer',
            'expires_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    /** @return BelongsTo<Transaction, $this> */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /** @return BelongsTo<SalesReturn, $this> */
    public function salesReturn(): BelongsTo
    {
        return $this->belongsTo(SalesReturn::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }
}
