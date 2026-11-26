<?php

namespace App\Http\Middleware;

use App\Enums\CashierShiftStatus;
use App\Models\CashierShift;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureHasOpenShift
{
    /**
     * Pastikan user yang login memiliki sesi shift berstatus open sebelum memproses transaksi kasir.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return redirect()->route('login');
        }

        $hasOpenShift = CashierShift::where('user_id', $user->id)
            ->where('status', CashierShiftStatus::Open->value)
            ->exists();

        if (! $hasOpenShift) {
            if ($request->expectsJson() && ! $request->hasHeader('X-Inertia')) {
                return response()->json([
                    'message' => 'Anda harus membuka sesi shift kasir terlebih dahulu sebelum memproses transaksi.',
                ], 422);
            }

            return redirect()->route('pos.shifts.index')
                ->with('error', 'Anda belum memiliki sesi shift aktif. Silakan buka shift terlebih dahulu sebelum menggunakan kasir.');
        }

        return $next($request);
    }
}
