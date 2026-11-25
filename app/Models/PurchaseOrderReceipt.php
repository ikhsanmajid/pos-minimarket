<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

#[Table('purchase_order_receipts')]
#[Fillable([
    'receipt_number',
    'purchase_order_id',
    'supplier_delivery_note',
    'received_date',
    'received_by',
    'notes',
])]
class PurchaseOrderReceipt extends Model
{
    use LogsActivity;

    /**
     * Logging dilakukan secara kontekstual di GoodsReceiptService agar tidak terjadi log ganda.
     *
     * @var array<int, string>
     */
    protected static array $recordEvents = [];

    protected function casts(): array
    {
        return [
            'received_date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (PurchaseOrderReceipt $receipt): void {
            if (empty($receipt->receipt_number)) {
                $dateStr = now()->format('Ymd');
                $prefix = "LPB-{$dateStr}-";
                $latest = static::where('receipt_number', 'like', "{$prefix}%")
                    ->orderByDesc('receipt_number')
                    ->value('receipt_number');
                $nextNumber = $latest ? ((int) substr($latest, strlen($prefix)) + 1) : 1;
                $receipt->receipt_number = sprintf('%s%04d', $prefix, $nextNumber);
            }
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::PurchaseOrder->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Penerimaan Barang {$this->receipt_number} berhasil dibuat.",
                'updated' => "Penerimaan Barang {$this->receipt_number} diperbarui.",
                'deleted' => "Penerimaan Barang {$this->receipt_number} dihapus.",
                default => "Penerimaan Barang {$this->receipt_number} ({$eventName}).",
            })
            ->logOnly(['receipt_number', 'purchase_order_id', 'supplier_delivery_note', 'received_date', 'notes'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderReceiptItem::class);
    }

    public function stockMovements(): MorphMany
    {
        return $this->morphMany(StockMovement::class, 'reference');
    }
}
