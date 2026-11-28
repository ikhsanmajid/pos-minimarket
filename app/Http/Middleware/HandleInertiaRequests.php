<?php

namespace App\Http\Middleware;

use App\Enums\CashierShiftStatus;
use App\Enums\UserRoles;
use App\Models\CashierShift;
use App\Services\StoreSettingService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        // dd($request->user());

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user() ? $request->user() : null,
            ],
            'storeSettings' => fn (): array => app(StoreSettingService::class)->getPublicSettings(),
            'activeShift' => function () use ($request): ?array {
                $user = $request->user();
                if (! $user || ! $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Cashier])) {
                    return null;
                }

                $shift = CashierShift::query()
                    ->where('user_id', $user->id)
                    ->where('status', CashierShiftStatus::Open->value)
                    ->latest('opened_at')
                    ->first(['id', 'shift_number', 'register_name', 'opened_at', 'starting_cash']);

                if (! $shift) {
                    return null;
                }

                return [
                    'id' => $shift->id,
                    'shift_number' => $shift->shift_number,
                    'register_name' => $shift->register_name,
                    'opened_at' => $shift->opened_at->format('d M Y H:i'),
                    'opened_at_human' => $shift->opened_at->diffForHumans(),
                    'starting_cash' => (float) $shift->starting_cash,
                ];
            },
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }
}
