<?php

use App\Http\Middleware\EnsureHasOpenShift;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
        $middleware->alias([
            'shift.open' => EnsureHasOpenShift::class,
        ]);
        $middleware->redirectUsersTo('/pos/dashboard');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (ThrottleRequestsException $e, $request) {
            if ($request->hasHeader('X-Inertia')) {
                throw ValidationException::withMessages([
                    'throttle' => 'Terlalu banyak request. Silakan coba beberapa saat lagi.',
                ]);
            }
        });
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Catch both Laravel Native and package-based Authorization Errors
        $exceptions->render(function (AccessDeniedHttpException $e, $request) {
            if ($request->hasHeader('X-Inertia')) {
                // Convert it into a Validation Error which Inertia handles gracefully
                throw ValidationException::withMessages([
                    'forbidden' => 'Anda tidak memiliki hak untuk mengakses resources ini.',
                ]);
            }
        });
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
