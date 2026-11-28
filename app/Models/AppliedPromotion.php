<?php

namespace App\Models;

use App\Enums\PromotionFunding;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $transaction_id
 * @property int|null $transaction_detail_id
 * @property int|null $promotion_id
 * @property int|null $voucher_id
 * @property string $type
 * @property PromotionFunding $funding
 * @property string $discount_amount
 * @property string $description_snapshot
 * @property array<string, mixed>|null $meta
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('applied_promotions')]
#[Fillable([
    'transaction_id',
    'transaction_detail_id',
    'promotion_id',
    'voucher_id',
    'type',
    'funding',
    'supplier_id',
    'discount_amount',
    'store_discount_amount',
    'supplier_discount_amount',
    'claim_status',
    'settlement_method',
    'settled_account_payable_id',
    'settled_product_id',
    'settled_product_qty',
    'settled_financial_account_id',
    'settled_financial_transaction_id',
    'settled_by',
    'claimed_at',
    'claim_reference',
    'claim_notes',
    'description_snapshot',
    'meta',
])]
class AppliedPromotion extends Model
{
    protected static function booted(): void
    {
        static::creating(function (AppliedPromotion $model): void {
            $discount = round((float) ($model->discount_amount ?? 0), 2);
            $fundingVal = $model->funding instanceof PromotionFunding
                ? $model->funding->value
                : (string) ($model->funding ?? 'store');

            $storeShare = 100.0;
            $supplierId = $model->supplier_id;

            if ($fundingVal === PromotionFunding::Supplier->value) {
                $storeShare = 0.0;
            } elseif ($fundingVal === PromotionFunding::Shared->value) {
                $storeShare = 50.0;
            }

            if ($model->promotion_id !== null) {
                $promo = Promotion::query()
                    ->select(['id', 'supplier_id', 'store_share_percent'])
                    ->find($model->promotion_id);
                if ($promo !== null) {
                    $supplierId = $supplierId ?? $promo->supplier_id;
                    if ($fundingVal === PromotionFunding::Shared->value) {
                        $storeShare = (float) $promo->store_share_percent;
                    }
                }
            } elseif ($model->voucher_id !== null) {
                $voucher = Voucher::query()
                    ->select(['id', 'supplier_id', 'store_share_percent'])
                    ->find($model->voucher_id);
                if ($voucher !== null) {
                    $supplierId = $supplierId ?? $voucher->supplier_id;
                    if ($fundingVal === PromotionFunding::Shared->value) {
                        $storeShare = (float) $voucher->store_share_percent;
                    }
                }
            }

            if ($fundingVal === PromotionFunding::Store->value) {
                $model->supplier_id = null;
                $model->store_discount_amount = $discount;
                $model->supplier_discount_amount = 0;
                $model->claim_status = 'not_applicable';
            } elseif ($fundingVal === PromotionFunding::Supplier->value) {
                $model->supplier_id = $supplierId;
                $model->store_discount_amount = 0;
                $model->supplier_discount_amount = $discount;
                $model->claim_status = $discount > 0 ? 'pending' : 'not_applicable';
            } else {
                $storeAmt = round($discount * ($storeShare / 100), 2);
                $supplierAmt = round($discount - $storeAmt, 2);
                $model->supplier_id = $supplierId;
                $model->store_discount_amount = $storeAmt;
                $model->supplier_discount_amount = $supplierAmt;
                $model->claim_status = $supplierAmt > 0 ? 'pending' : 'not_applicable';
            }
        });
    }

    protected function casts(): array
    {
        return [
            'funding' => PromotionFunding::class,
            'discount_amount' => 'decimal:2',
            'store_discount_amount' => 'decimal:2',
            'supplier_discount_amount' => 'decimal:2',
            'claimed_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    /** @return BelongsTo<Supplier, $this> */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /** @return BelongsTo<AccountPayable, $this> */
    public function settledAccountPayable(): BelongsTo
    {
        return $this->belongsTo(AccountPayable::class, 'settled_account_payable_id');
    }

    /** @return BelongsTo<Product, $this> */
    public function settledProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'settled_product_id');
    }

    /** @return BelongsTo<FinancialAccount, $this> */
    public function settledFinancialAccount(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class, 'settled_financial_account_id');
    }

    /** @return BelongsTo<FinancialTransaction, $this> */
    public function settledFinancialTransaction(): BelongsTo
    {
        return $this->belongsTo(FinancialTransaction::class, 'settled_financial_transaction_id');
    }

    /** @return BelongsTo<User, $this> */
    public function settler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'settled_by');
    }

    /** @return BelongsTo<Transaction, $this> */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /** @return BelongsTo<TransactionDetail, $this> */
    public function transactionDetail(): BelongsTo
    {
        return $this->belongsTo(TransactionDetail::class);
    }

    /** @return BelongsTo<Promotion, $this> */
    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }

    /** @return BelongsTo<Voucher, $this> */
    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }
}
