<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

#[Table('products')]
#[Fillable(['category_id', 'barcode', 'name', 'buy_price', 'sell_price', 'stock', 'min_stock', 'image', 'active'])]
class Product extends Model
{
    use LogsActivity, SoftDeletes;

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'buy_price' => 'decimal:2',
            'sell_price' => 'decimal:2',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Product->value)
            ->logOnly(['category_id', 'barcode', 'name', 'buy_price', 'sell_price', 'stock', 'min_stock', 'image', 'active'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    public function tapActivity(\Spatie\Activitylog\Contracts\Activity $activity, string $eventName): void
    {
        if ($this->category_id) {
            $activity->properties = $activity->properties->merge([
                'category_name' => $this->category?->name,
            ]);
        }
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function transactionDetails(): HasMany
    {
        return $this->hasMany(TransactionDetail::class);
    }
}
