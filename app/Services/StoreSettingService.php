<?php

namespace App\Services;

use App\Enums\RoundingMode;
use App\Models\StoreSetting;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class StoreSettingService
{
    public const string CACHE_KEY = 'store_settings.current';

    /**
     * Ambil pengaturan toko saat ini dari cache (disimpan sebagai array skalar agar aman di Laravel 13),
     * atau buat nilai default secara aman jika belum ada.
     */
    public function get(): StoreSetting
    {
        $cached = Cache::rememberForever(self::CACHE_KEY, function (): array {
            $setting = StoreSetting::query()->first();

            if (! $setting instanceof StoreSetting) {
                /** @var StoreSetting $setting */
                $setting = StoreSetting::withoutEvents(fn (): StoreSetting => StoreSetting::create([
                    'store_name' => 'POS Minimarket',
                    'store_address' => null,
                    'store_phone' => null,
                    'store_logo' => null,
                    'receipt_header' => null,
                    'receipt_footer' => 'Terima kasih telah berbelanja.',
                    'default_tax_rate' => 0.00,
                    'rounding_mode' => RoundingMode::None,
                    'shift_variance_tolerance' => 0.00,
                ]));
            }

            return $setting->getAttributes();
        });

        $model = new StoreSetting;
        $model->setRawAttributes($cached, true);
        $model->exists = true;

        return $model;
    }

    /**
     * Kembalikan subset pengaturan publik yang aman untuk frontend (Inertia shared props & halaman settings).
     *
     * @return array{
     *     store_name: string,
     *     store_address: string|null,
     *     store_phone: string|null,
     *     store_logo: string|null,
     *     store_logo_url: string|null,
     *     receipt_header: string|null,
     *     receipt_footer: string|null,
     *     default_tax_rate: float,
     *     rounding_mode: string,
     *     shift_variance_tolerance: float
     * }
     */
    public function getPublicSettings(): array
    {
        $setting = $this->get();

        return [
            'store_name' => $setting->store_name,
            'store_address' => $setting->store_address,
            'store_phone' => $setting->store_phone,
            'store_logo' => $setting->store_logo,
            'store_logo_url' => $setting->logo_url,
            'receipt_header' => $setting->receipt_header,
            'receipt_footer' => $setting->receipt_footer,
            'default_tax_rate' => (float) $setting->default_tax_rate,
            'rounding_mode' => $setting->rounding_mode->value,
            'shift_variance_tolerance' => (float) $setting->shift_variance_tolerance,
        ];
    }

    /**
     * Perbarui pengaturan toko secara atomik, kelola upload/hapus logo, dan bersihkan cache.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(array $data, ?UploadedFile $logo = null, bool $removeLogo = false): StoreSetting
    {
        $oldLogoToDelete = null;
        $newLogoPath = null;

        if ($logo !== null) {
            $storedPath = $logo->store('store', 'public');
            $newLogoPath = $storedPath !== false ? $storedPath : null;
        }

        try {
            /** @var StoreSetting $updated */
            $updated = DB::transaction(function () use ($data, $newLogoPath, $removeLogo, &$oldLogoToDelete): StoreSetting {
                $setting = StoreSetting::query()->lockForUpdate()->first();

                if (! $setting instanceof StoreSetting) {
                    /** @var StoreSetting $setting */
                    $setting = StoreSetting::withoutEvents(fn (): StoreSetting => StoreSetting::create([
                        'store_name' => 'POS Minimarket',
                        'default_tax_rate' => 0.00,
                        'rounding_mode' => RoundingMode::None,
                        'shift_variance_tolerance' => 0.00,
                    ]));
                }

                $payload = [
                    'store_name' => trim((string) $data['store_name']),
                    'store_address' => isset($data['store_address']) && trim((string) $data['store_address']) !== ''
                        ? trim((string) $data['store_address'])
                        : null,
                    'store_phone' => isset($data['store_phone']) && trim((string) $data['store_phone']) !== ''
                        ? trim((string) $data['store_phone'])
                        : null,
                    'receipt_header' => isset($data['receipt_header']) && trim((string) $data['receipt_header']) !== ''
                        ? trim((string) $data['receipt_header'])
                        : null,
                    'receipt_footer' => isset($data['receipt_footer']) && trim((string) $data['receipt_footer']) !== ''
                        ? trim((string) $data['receipt_footer'])
                        : null,
                    'default_tax_rate' => round((float) $data['default_tax_rate'], 2),
                    'rounding_mode' => RoundingMode::from((string) $data['rounding_mode']),
                    'shift_variance_tolerance' => round((float) $data['shift_variance_tolerance'], 2),
                ];

                if ($newLogoPath !== null) {
                    $oldLogoToDelete = $setting->store_logo;
                    $payload['store_logo'] = $newLogoPath;
                } elseif ($removeLogo && $setting->store_logo !== null) {
                    $oldLogoToDelete = $setting->store_logo;
                    $payload['store_logo'] = null;
                }

                $setting->update($payload);

                return $setting->fresh() ?? $setting;
            });
        } catch (\Throwable $e) {
            if ($newLogoPath !== null) {
                Storage::disk('public')->delete($newLogoPath);
            }

            throw $e;
        }

        if ($oldLogoToDelete !== null && $oldLogoToDelete !== $updated->store_logo) {
            Storage::disk('public')->delete($oldLogoToDelete);
        }

        $this->clearCache();

        return $updated;
    }

    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
