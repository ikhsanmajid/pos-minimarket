<?php

namespace App\Http\Controllers;

use App\Enums\RoundingMode;
use App\Http\Requests\UpdateStoreSettingRequest;
use App\Models\StoreSetting;
use App\Services\StoreSettingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class StoreSettingController extends Controller
{
    public function __construct(public StoreSettingService $storeSettingService) {}

    public function edit(): Response
    {
        Gate::authorize('viewAny', StoreSetting::class);

        return Inertia::render('POS/Settings/StoreSetting', [
            'settings' => $this->storeSettingService->getPublicSettings(),
            'roundingModes' => RoundingMode::options(),
        ]);
    }

    public function update(UpdateStoreSettingRequest $request): RedirectResponse
    {
        Gate::authorize('update', $this->storeSettingService->get());

        $this->storeSettingService->update(
            data: $request->validated(),
            logo: $request->file('store_logo'),
            removeLogo: $request->boolean('remove_logo'),
        );

        return redirect()->route('pos.settings.edit')
            ->with('success', 'Pengaturan toko berhasil disimpan.');
    }
}
