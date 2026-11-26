<?php

namespace App\Http\Controllers;

use App\Enums\UserRoles;
use App\Models\User;
use App\Services\DashboardService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __construct(public DashboardService $dashboardService) {}

    /**
     * Dashboard Role-Based dengan Inertia Deferred Props untuk komponen berat.
     * Payload diisolasi ketat di backend berdasarkan role user yang login.
     */
    public function index(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();
        $role = $user->role?->value ?? UserRoles::Cashier->value;

        if ($user->hasRoles(UserRoles::Admin)) {
            $period = $this->dashboardService->resolvePeriod($request);
            $immediate = $this->dashboardService->getAdminImmediateData($period);

            return Inertia::render('POS/Home', [
                'dashboardRole' => UserRoles::Admin->value,
                'period' => [
                    'preset' => $period['preset'],
                    'start_date' => $period['start_date'],
                    'end_date' => $period['end_date'],
                    'label' => $period['label'],
                ],
                'kpis' => $immediate['kpis'],
                'alertCounts' => $immediate['alertCounts'],
                'activeShifts' => $immediate['activeShifts'],
                'salesTrend' => Inertia::defer(
                    fn (): array => $this->dashboardService->getSalesProfitTrend($period, includeProfit: true),
                    'charts'
                ),
                'paymentComposition' => Inertia::defer(
                    fn (): array => $this->dashboardService->getPaymentMethodComposition($period),
                    'charts'
                ),
                'actionableAlerts' => Inertia::defer(
                    fn (): array => $this->dashboardService->getActionableAlerts(includePayables: true),
                    'widgets'
                ),
                'topProducts' => Inertia::defer(
                    fn (): array => $this->dashboardService->getTopProducts($period, 5),
                    'widgets'
                ),
                'recentActivities' => Inertia::defer(
                    fn (): array => $this->dashboardService->getRecentActivities(8, includeFinance: true),
                    'widgets'
                ),
            ]);
        }

        if ($user->hasRoles(UserRoles::Supervisor)) {
            $immediate = $this->dashboardService->getSupervisorImmediateData();
            $now = CarbonImmutable::now();
            $sevenDays = [
                'start' => $now->subDays(6)->startOfDay(),
                'end' => $now->endOfDay(),
            ];

            return Inertia::render('POS/Home', [
                'dashboardRole' => UserRoles::Supervisor->value,
                'kpis' => $immediate['kpis'],
                'alertCounts' => $immediate['alertCounts'],
                'activeShifts' => $immediate['activeShifts'],
                'salesTrend7d' => Inertia::defer(
                    fn (): array => $this->dashboardService->getSalesProfitTrend($sevenDays, includeProfit: false),
                    'charts'
                ),
                'actionableAlerts' => Inertia::defer(
                    fn (): array => $this->dashboardService->getActionableAlerts(includePayables: false),
                    'widgets'
                ),
                'recentActivities' => Inertia::defer(
                    fn (): array => $this->dashboardService->getRecentActivities(6, includeFinance: false),
                    'widgets'
                ),
            ]);
        }

        if ($user->hasRoles(UserRoles::Warehouse)) {
            $immediate = $this->dashboardService->getWarehouseImmediateData();

            return Inertia::render('POS/Home', [
                'dashboardRole' => UserRoles::Warehouse->value,
                'kpis' => $immediate['kpis'],
                'warehouseWidgets' => Inertia::defer(
                    fn (): array => $this->dashboardService->getWarehouseDeferredData(),
                    'widgets'
                ),
            ]);
        }

        // Default / Cashier: hanya data kesiapan shift pribadi & 5 riwayat shift sendiri
        $cashierData = $this->dashboardService->getCashierData($user);

        return Inertia::render('POS/Home', [
            'dashboardRole' => $role,
            'cashierData' => $cashierData,
        ]);
    }
}
