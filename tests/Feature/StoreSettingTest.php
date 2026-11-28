<?php

use App\Enums\ActivityLogCategory;
use App\Enums\RoundingMode;
use App\Enums\UserRoles;
use App\Models\StoreSetting;
use App\Models\User;
use App\Services\StoreSettingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Activitylog\Models\Activity;

uses(RefreshDatabase::class);

beforeEach(function () {
    Cache::forget(StoreSettingService::CACHE_KEY);
});

it('allows admin to view and update store settings', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    $this->actingAs($admin)
        ->get(route('pos.settings.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Settings/StoreSetting')
            ->has('settings.store_name')
            ->has('roundingModes', count(RoundingMode::cases()))
        );

    $this->actingAs($admin)
        ->post(route('pos.settings.update'), [
            'store_name' => 'Minimarket Berkah Jaya',
            'store_address' => 'Jl. Merdeka No. 45, Bandung',
            'store_phone' => '0812-9999-8888',
            'receipt_header' => 'Belanja Hemat Setiap Hari',
            'receipt_footer' => 'Terima kasih sudah berbelanja di Minimarket Berkah Jaya!',
            'default_tax_rate' => 11,
            'rounding_mode' => RoundingMode::Nearest100->value,
            'shift_variance_tolerance' => 15000,
        ])
        ->assertRedirect(route('pos.settings.edit'))
        ->assertSessionHas('success');

    $setting = StoreSetting::query()->firstOrFail();

    expect($setting->store_name)->toBe('Minimarket Berkah Jaya')
        ->and($setting->store_address)->toBe('Jl. Merdeka No. 45, Bandung')
        ->and($setting->store_phone)->toBe('0812-9999-8888')
        ->and($setting->receipt_header)->toBe('Belanja Hemat Setiap Hari')
        ->and($setting->receipt_footer)->toBe('Terima kasih sudah berbelanja di Minimarket Berkah Jaya!')
        ->and((float) $setting->default_tax_rate)->toBe(11.0)
        ->and($setting->rounding_mode)->toBe(RoundingMode::Nearest100)
        ->and((float) $setting->shift_variance_tolerance)->toBe(15000.0);
});

it('forbids non-admin roles from viewing or updating store settings', function (UserRoles $role) {
    $user = User::factory()->create(['role' => $role]);

    $this->actingAs($user)
        ->get(route('pos.settings.edit'))
        ->assertForbidden();

    $this->actingAs($user)
        ->post(route('pos.settings.update'), [
            'store_name' => 'Unauthorized Update',
            'default_tax_rate' => 10,
            'rounding_mode' => RoundingMode::None->value,
            'shift_variance_tolerance' => 5000,
        ])
        ->assertForbidden();
})->with([
    'cashier' => [UserRoles::Cashier],
    'supervisor' => [UserRoles::Supervisor],
    'warehouse' => [UserRoles::Warehouse],
]);

it('rejects invalid store setting validation inputs', function () {
    Storage::fake('public');
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    // PPN < 0, rounding_mode invalid, shift_variance_tolerance negatif
    $this->actingAs($admin)
        ->post(route('pos.settings.update'), [
            'store_name' => 'Toko Test',
            'default_tax_rate' => -5,
            'rounding_mode' => 'invalid_mode',
            'shift_variance_tolerance' => -1000,
        ])
        ->assertSessionHasErrors([
            'default_tax_rate',
            'rounding_mode',
            'shift_variance_tolerance',
        ]);

    // PPN > 100
    $this->actingAs($admin)
        ->post(route('pos.settings.update'), [
            'store_name' => 'Toko Test',
            'default_tax_rate' => 101,
            'rounding_mode' => RoundingMode::None->value,
            'shift_variance_tolerance' => 0,
        ])
        ->assertSessionHasErrors(['default_tax_rate']);

    // Logo bukan gambar
    $notImage = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');
    $this->actingAs($admin)
        ->post(route('pos.settings.update'), [
            'store_name' => 'Toko Test',
            'store_logo' => $notImage,
            'default_tax_rate' => 0,
            'rounding_mode' => RoundingMode::None->value,
            'shift_variance_tolerance' => 0,
        ])
        ->assertSessionHasErrors(['store_logo']);

    // Logo melebihi 2048 KB
    $oversizedLogo = UploadedFile::fake()->image('huge-logo.png')->size(3000);
    $this->actingAs($admin)
        ->post(route('pos.settings.update'), [
            'store_name' => 'Toko Test',
            'store_logo' => $oversizedLogo,
            'default_tax_rate' => 0,
            'rounding_mode' => RoundingMode::None->value,
            'shift_variance_tolerance' => 0,
        ])
        ->assertSessionHasErrors(['store_logo']);
});

it('handles logo upload, replacement cleanup, and removal on public disk', function () {
    Storage::fake('public');
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    $firstLogo = UploadedFile::fake()->image('logo-awal.png', 200, 200);

    $this->actingAs($admin)
        ->post(route('pos.settings.update'), [
            'store_name' => 'Minimarket Logo',
            'store_logo' => $firstLogo,
            'default_tax_rate' => 0,
            'rounding_mode' => RoundingMode::None->value,
            'shift_variance_tolerance' => 0,
        ])
        ->assertRedirect(route('pos.settings.edit'));

    $setting = StoreSetting::query()->firstOrFail();
    $firstPath = $setting->store_logo;

    expect($firstPath)->not->toBeNull()
        ->and($firstPath)->toStartWith('store/');
    Storage::disk('public')->assertExists((string) $firstPath);

    // Ganti logo -> logo lama terhapus, logo baru tersimpan
    $secondLogo = UploadedFile::fake()->image('logo-baru.webp', 200, 200);

    $this->actingAs($admin)
        ->post(route('pos.settings.update'), [
            'store_name' => 'Minimarket Logo',
            'store_logo' => $secondLogo,
            'default_tax_rate' => 0,
            'rounding_mode' => RoundingMode::None->value,
            'shift_variance_tolerance' => 0,
        ])
        ->assertRedirect(route('pos.settings.edit'));

    $setting->refresh();
    $secondPath = $setting->store_logo;

    expect($secondPath)->not->toBeNull()
        ->and($secondPath)->not->toBe($firstPath);
    Storage::disk('public')->assertMissing((string) $firstPath);
    Storage::disk('public')->assertExists((string) $secondPath);

    // Hapus logo -> file terhapus dan kolom store_logo menjadi null
    $this->actingAs($admin)
        ->post(route('pos.settings.update'), [
            'store_name' => 'Minimarket Logo',
            'remove_logo' => true,
            'default_tax_rate' => 0,
            'rounding_mode' => RoundingMode::None->value,
            'shift_variance_tolerance' => 0,
        ])
        ->assertRedirect(route('pos.settings.edit'));

    $setting->refresh();

    expect($setting->store_logo)->toBeNull();
    Storage::disk('public')->assertMissing((string) $secondPath);
});

it('invalidates cached store settings immediately after update', function () {
    $service = app(StoreSettingService::class);

    $initial = $service->get();
    expect($initial->store_name)->toBe('POS Minimarket')
        ->and(Cache::has(StoreSettingService::CACHE_KEY))->toBeTrue();

    $service->update([
        'store_name' => 'Toko Cahaya Baru',
        'default_tax_rate' => 11,
        'rounding_mode' => RoundingMode::Nearest500->value,
        'shift_variance_tolerance' => 25000,
    ]);

    expect(Cache::has(StoreSettingService::CACHE_KEY))->toBeFalse();

    $fresh = $service->get();
    expect($fresh->store_name)->toBe('Toko Cahaya Baru')
        ->and((float) $fresh->default_tax_rate)->toBe(11.0)
        ->and($fresh->rounding_mode)->toBe(RoundingMode::Nearest500)
        ->and((float) $fresh->shift_variance_tolerance)->toBe(25000.0);
});

it('shares public storeSettings in inertia shared props', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    app(StoreSettingService::class)->update([
        'store_name' => 'Minimarket Nusantara',
        'store_address' => 'Jl. Sudirman No. 10',
        'store_phone' => '021-5551234',
        'receipt_header' => 'Promo Akhir Pekan',
        'receipt_footer' => 'Sampai jumpa kembali',
        'default_tax_rate' => 11,
        'rounding_mode' => RoundingMode::Up100->value,
        'shift_variance_tolerance' => 5000,
    ]);

    $this->actingAs($admin)
        ->get(route('pos.dashboard.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('storeSettings.store_name', 'Minimarket Nusantara')
            ->where('storeSettings.store_address', 'Jl. Sudirman No. 10')
            ->where('storeSettings.store_phone', '021-5551234')
            ->where('storeSettings.receipt_header', 'Promo Akhir Pekan')
            ->where('storeSettings.receipt_footer', 'Sampai jumpa kembali')
            ->where('storeSettings.default_tax_rate', 11)
            ->where('storeSettings.rounding_mode', RoundingMode::Up100->value)
            ->where('storeSettings.shift_variance_tolerance', 5000)
        );
});

it('records store setting changes in spatie activity log with old and new values', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    // Inisialisasi record default terlebih dahulu
    app(StoreSettingService::class)->get();

    $this->actingAs($admin)
        ->post(route('pos.settings.update'), [
            'store_name' => 'Minimarket Sejahtera',
            'store_address' => 'Jl. Ahmad Yani No. 88',
            'store_phone' => '0811-2233-4455',
            'receipt_header' => 'Selamat Datang',
            'receipt_footer' => 'Terima Kasih',
            'default_tax_rate' => 11,
            'rounding_mode' => RoundingMode::Down100->value,
            'shift_variance_tolerance' => 20000,
        ])
        ->assertRedirect(route('pos.settings.edit'));

    /** @var Activity|null $activity */
    $activity = Activity::query()
        ->where('log_name', ActivityLogCategory::StoreSetting->value)
        ->where('event', 'updated')
        ->latest('id')
        ->first();

    expect($activity)->not->toBeNull()
        ->and($activity?->causer_id)->toBe($admin->id)
        ->and($activity?->description)->toContain('Minimarket Sejahtera');

    $changes = $activity?->attribute_changes?->toArray() ?? [];
    expect($changes['old']['store_name'] ?? null)->toBe('POS Minimarket')
        ->and($changes['attributes']['store_name'] ?? null)->toBe('Minimarket Sejahtera')
        ->and($changes['attributes']['rounding_mode'] ?? null)->toBe(RoundingMode::Down100->value);
});
