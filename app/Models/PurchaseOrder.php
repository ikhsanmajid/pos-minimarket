<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReceivingStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
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
    'submitted_at',
    'approved_by',
    'approved_at',
    'rejected_by',
    'rejected_at',
    'rejection_reason',
    'status',
    'receiving_status',
    'payment_status',
    'subtotal',
    'discount_type',
    'discount_value',
    'discount_amount',
    'tax_type',
    'tax_value',
    'tax_percentage',
    'tax_amount',
    'total_amount',
    'notes',
])]
class PurchaseOrder extends Model
{
    use LogsActivity, SoftDeletes;

    protected $attributes = [
        'status' => 'draft',
        'receiving_status' => 'unreceived',
        'payment_status' => 'unpaid',
        'discount_type' => 'fixed',
        'tax_type' => 'percent',
    ];

    protected function casts(): array
    {
        return [
            'order_date' => 'date',
            'expected_date' => 'date',
            'received_at' => 'datetime',
            'due_date' => 'date',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
            'status' => PurchaseOrderStatus::class,
            'receiving_status' => ReceivingStatus::class,
            'payment_status' => PaymentStatus::class,
            'subtotal' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_value' => 'decimal:2',
            'tax_percentage' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (PurchaseOrder $po): void {
            if (empty($po->po_number)) {
                $dateStr = now()->format('Ymd');
                $prefix = "PO-{$dateStr}-";
                $latest = static::withTrashed()
                    ->where('po_number', 'like', "{$prefix}%")
                    ->orderByDesc('po_number')
                    ->value('po_number');
                $nextNumber = $latest ? ((int) substr($latest, strlen($prefix)) + 1) : 1;
                $po->po_number = sprintf('%s%04d', $prefix, $nextNumber);
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
                'restored' => "Purchase Order {$this->po_number} dipulihkan.",
                default => "Purchase Order {$this->po_number} ({$eventName}).",
            })
            ->logOnly([
                'po_number',
                'supplier_id',
                'status',
                'receiving_status',
                'payment_status',
                'subtotal',
                'discount_type',
                'discount_value',
                'discount_amount',
                'tax_type',
                'tax_value',
                'tax_percentage',
                'tax_amount',
                'total_amount',
                'received_at',
                'due_date',
                'approved_by',
                'approved_at',
                'rejected_by',
                'rejected_at',
                'rejection_reason',
                'notes',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    /**
     * Aturan Penguncian Permanen:
     * PO terkunci permanen apabila sudah Lunas (paid) DAN Barang Diterima Semua (received).
     */
    public function isLocked(): bool
    {
        return $this->payment_status === PaymentStatus::Paid
            && $this->receiving_status === ReceivingStatus::Received;
    }

    /**
     * Cek apakah PO sudah memiliki penerimaan barang (LPB / qty diterima > 0).
     */
    public function hasAnyReceipts(): bool
    {
        if ($this->receiving_status !== ReceivingStatus::Unreceived) {
            return true;
        }

        if ($this->relationLoaded('items')) {
            return $this->items->contains(
                fn (PurchaseOrderItem $item): bool => (int) $item->quantity_received > 0 || (int) $item->free_qty_received > 0
            );
        }

        return $this->items()
            ->where(function ($query): void {
                $query->where('quantity_received', '>', 0)
                    ->orWhere('free_qty_received', '>', 0);
            })
            ->exists();
    }

    /**
     * Cek apakah PO sudah memiliki pembayaran hutang.
     */
    public function hasAnyPayments(): bool
    {
        if ($this->payment_status !== PaymentStatus::Unpaid) {
            return true;
        }

        if ($this->relationLoaded('accountPayable')) {
            return $this->accountPayable !== null && (float) $this->accountPayable->paid_amount > 0;
        }

        return $this->accountPayable()->where('paid_amount', '>', 0)->exists();
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class)->withTrashed();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(PurchaseOrderReceipt::class)->latest('received_date')->latest('id');
    }

    public function accountPayable(): HasOne
    {
        return $this->hasOne(AccountPayable::class);
    }
}
