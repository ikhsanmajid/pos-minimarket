<?php

namespace App\Models;

use App\Enums\FinancialCategoryType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Table('financial_categories')]
#[Fillable([
    'code',
    'name',
    'type',
    'is_system',
    'is_active',
    'description',
])]
class FinancialCategory extends Model
{
    use SoftDeletes;

    protected function casts(): array
    {
        return [
            'type' => FinancialCategoryType::class,
            'is_system' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(FinancialTransaction::class);
    }
}
