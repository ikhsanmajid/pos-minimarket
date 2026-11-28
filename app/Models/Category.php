<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

#[Table('categories')]
#[Fillable(['code', 'name', 'slug', 'description', 'is_active', 'is_promo_excluded'])]
class Category extends Model
{
    use LogsActivity, SoftDeletes;

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_promo_excluded' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Category->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Kategori {$this->name} berhasil dibuat.",
                'updated' => "Kategori {$this->name} diperbarui.",
                'deleted' => "Kategori {$this->name} dihapus.",
                'restored' => "Kategori {$this->name} dipulihkan.",
                default => "Kategori {$this->name} ({$eventName}).",
            })
            ->logOnly(['code', 'name', 'slug', 'description', 'is_active', 'is_promo_excluded'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    public function isExcludedFromPromotions(): bool
    {
        if ($this->is_promo_excluded) {
            return true;
        }

        /** @var array<int, string> $keywords */
        $keywords = config('pos_promotions.excluded_category_keywords', []);
        $haystack = strtolower(trim(($this->name ?? '').' '.($this->slug ?? '')));

        foreach ($keywords as $keyword) {
            $needle = strtolower(trim($keyword));
            if ($needle === '') {
                continue;
            }

            if (preg_match('/(^|[^a-z0-9])'.preg_quote($needle, '/').'([^a-z0-9]|$)/', $haystack) === 1) {
                return true;
            }
        }

        return false;
    }

    protected static function booted(): void
    {
        static::saving(function (Category $category) {
            if ($category->isDirty('name')) {
                $category->slug = Str::slug($category->name);
            }
        });
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }
}
