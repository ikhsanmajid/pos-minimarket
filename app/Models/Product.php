<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Table('products')]
#[Fillable(['category_id', 'barcode', 'name', 'buy_price', 'sell_price', 'stock', 'min_stock', 'image', 'active'])]
class Product extends Model
{
    //
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'buy_price' => 'decimal:2',
            'sell_price' => 'decimal:2',
        ];
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
