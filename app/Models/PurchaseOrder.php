<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

#[Table('purchase_orders')]
#[Fillable([
    'po_number',
    'supplier_id',
    'user_id',
    'received_by',
    'order_date',
    'expected_date',
    'received_at',
    'due_date',
    'status',
    'payment_status',
    'subtotal',
    'discount_type',
    'discount_value',
    'discount_amount',
    'tax_percentage',
    'tax_amount',
    'total_amount',
    'notes',
])]
class PurchaseOrder extends Model
{
    use LogsActivity, SoftDeletes;

    protected function casts(): array
    {
        return [
            'order_date' => 'date',
            'expected_date' => 'date',
            'received_at' => 'datetime',
            'due_date' => 'date',
            'status' => PurchaseOrderStatus::class,
            'payment_status' => PaymentStatus::class,
            'subtotal' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_percentage' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (PurchaseOrder $po) {
            if (empty($po->po_number)) {
                $dateStr = now()->format('Ymd');
                $countToday = static::withTrashed()
                    ->whereDate('created_at', now()->toDateString())
                    ->count();
                $po->po_number = sprintf('PO-%s-%04d', $dateStr, $countToday + 1);
            }
        });
    }

    /**
     * Event created & updated ditangani secara kontekstual di PurchaseOrderService
     * agar tidak terjadi log ganda. Auto-logging Eloquent hanya mencatat penghapusan.
     *
     * @var array<int, string>
     */
    protected static array $recordEvents = ['deleted'];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::PurchaseOrder->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Purchase Order {$this->po_number} berhasil dibuat.",
                'updated' => "Purchase Order {$this->po_number} diperbarui.",
                'deleted' => "Purchase Order {$this->po_number} dihapus.",
                default => "Purchase Order {$this->po_number} ({$eventName}).",
            })
            ->logOnly([
                'po_number',
                'supplier_id',
                'status',
                'payment_status',
                'subtotal',
                'discount_type',
                'discount_value',
                'discount_amount',
                'tax_percentage',
                'tax_amount',
                'total_amount',
                'received_at',
                'due_date',
                'notes',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }
}
