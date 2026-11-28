<?php

namespace App\Enums;

enum StockOpnameStatus: string
{
    case Draft = 'draft';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::InProgress => 'Berlangsung',
            self::Completed => 'Selesai',
            self::Cancelled => 'Dibatalkan',
        };
    }

    public function badgeVariant(): string
    {
        return match ($this) {
            self::Draft => 'slate',
            self::InProgress => 'amber',
            self::Completed => 'emerald',
            self::Cancelled => 'rose',
        };
    }

    public function isEditable(): bool
    {
        return in_array($this, [self::Draft, self::InProgress], true);
    }

    public function isLocked(): bool
    {
        return in_array($this, [self::Completed, self::Cancelled], true);
    }

    public function canTransitionTo(self $target): bool
    {
        return match ($this) {
            self::Draft => in_array($target, [self::InProgress, self::Completed, self::Cancelled], true),
            self::InProgress => in_array($target, [self::Completed, self::Cancelled], true),
            self::Completed, self::Cancelled => false,
        };
    }
}
