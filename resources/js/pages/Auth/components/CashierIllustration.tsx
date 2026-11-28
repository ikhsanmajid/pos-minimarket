import React from 'react';

export function CashierIllustration({ className = '' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 640 520"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className={className}
        >
            <defs>
                <linearGradient id="blobGrad" x1="320" y1="80" x2="640" y2="520" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#A8D8FF" />
                    <stop offset="100%" stopColor="#CBE8FF" />
                </linearGradient>
                <linearGradient id="sweaterGrad" x1="430" y1="190" x2="540" y2="395" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#1A65F6" />
                    <stop offset="100%" stopColor="#2B67F6" />
                </linearGradient>
                <linearGradient id="sleeveGrad" x1="490" y1="210" x2="585" y2="370" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#5B9BFF" />
                </linearGradient>
                <linearGradient id="skinGrad" x1="440" y1="100" x2="520" y2="210" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFD2B3" />
                    <stop offset="100%" stopColor="#F5B48C" />
                </linearGradient>
                <linearGradient id="counterTopGrad" x1="120" y1="388" x2="640" y2="412" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#CE8456" />
                    <stop offset="100%" stopColor="#B86D40" />
                </linearGradient>
                <linearGradient id="counterBodyGrad" x1="380" y1="412" x2="380" y2="520" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FCD3B4" />
                    <stop offset="100%" stopColor="#F9C59E" />
                </linearGradient>
                <linearGradient id="drawerGrad" x1="185" y1="362" x2="345" y2="390" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#A6ACB4" />
                    <stop offset="100%" stopColor="#848B94" />
                </linearGradient>
                <linearGradient id="screenBezelGrad" x1="205" y1="238" x2="355" y2="328" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#727780" />
                    <stop offset="100%" stopColor="#4A4E55" />
                </linearGradient>
            </defs>

            {/* Soft sky-blue organic background blobs */}
            <g className="dark:opacity-20">
                <path
                    d="M640 120C575 74 472 78 408 134C348 186 320 265 294 318C262 276 196 244 134 268C70 292 48 372 72 444C88 492 126 516 174 520H640V120Z"
                    fill="url(#blobGrad)"
                />
                <ellipse cx="485" cy="240" rx="125" ry="135" fill="#B8E0FF" opacity="0.45" />
            </g>

            {/* Cashier Character */}
            <g>
                {/* Left Sleeve (behind torso) */}
                <path
                    d="M424 218C404 238 394 282 388 338C385 362 384 378 384 390H438L446 248L424 218Z"
                    fill="#3475F6"
                />

                {/* Torso / Blue Sweater */}
                <path
                    d="M422 214C438 198 468 194 494 196C526 198 552 214 562 246C574 286 572 346 554 390H404C400 344 404 258 422 214Z"
                    fill="url(#sweaterGrad)"
                />

                {/* Subtle Torso Shading */}
                <path
                    d="M420 278C434 310 478 340 546 346L540 390H404C402 356 406 314 420 278Z"
                    fill="#1554D6"
                    opacity="0.35"
                />

                {/* White Shirt Collar */}
                <path
                    d="M460 193L484 218L516 195L504 180H468L460 193Z"
                    fill="#F8FAFC"
                />
                <path
                    d="M460 193L474 219L484 218L468 188L460 193Z"
                    fill="#E2E8F0"
                />
                <path
                    d="M516 195L496 221L484 218L506 188L516 195Z"
                    fill="#E2E8F0"
                />

                {/* Neck */}
                <path
                    d="M471 174H504V198C504 206 495 214 486 214C477 214 471 206 471 198V174Z"
                    fill="#F2B189"
                />

                {/* Head */}
                <path
                    d="M450 116C450 86 472 70 498 70C524 70 542 90 542 122C542 156 520 188 494 190C468 192 450 162 450 116Z"
                    fill="url(#skinGrad)"
                />

                {/* Hair */}
                <path
                    d="M446 116C438 102 432 82 442 66C452 50 474 52 490 62C504 70 518 66 534 72C550 78 558 98 556 122C555 138 548 152 541 158C542 142 544 128 538 118C534 112 526 112 526 124C526 130 524 134 520 132C516 122 518 110 514 106C504 112 478 118 450 114L446 116Z"
                    fill="#232830"
                />
                {/* Hair Highlight */}
                <path
                    d="M454 68C464 60 478 62 490 70C504 78 524 74 536 82"
                    stroke="#3B4250"
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity="0.55"
                />

                {/* Right Arm Sleeve (foreground, bent pointing left) */}
                <path
                    d="M548 214C568 220 584 242 586 274C588 308 576 346 544 358C516 368 474 342 448 314L464 282C488 296 516 306 532 302C536 280 532 248 532 228L548 214Z"
                    fill="url(#sleeveGrad)"
                />

                {/* Pointing Hand */}
                <path
                    d="M466 284C456 278 442 274 426 274H402C396 274 393 279 396 283C399 287 408 287 420 288C422 294 426 302 436 308C446 314 458 314 466 306L466 284Z"
                    fill="url(#skinGrad)"
                />
            </g>

            {/* POS Terminal / Cash Register */}
            <g>
                {/* Cash Drawer Base */}
                <rect x="184" y="362" width="168" height="28" rx="4" fill="url(#drawerGrad)" />
                {/* Dark Right Side of Drawer */}
                <path d="M312 362H348C350.2 362 352 363.8 352 366V390H312V362Z" fill="#41454C" />
                {/* Drawer Slot / Handle */}
                <path
                    d="M198 390V374C198 370.7 200.7 368 204 368H222C225.3 368 228 370.7 228 374V390H198Z"
                    fill="#5A6068"
                />
                <rect x="204" y="374" width="18" height="16" rx="2" fill="#7D848D" />
                {/* Top Accent Strip on Drawer */}
                <rect x="314" y="357" width="18" height="5" rx="2" fill="#32363C" />

                {/* Terminal Pedestal / Stand */}
                <path d="M236 320H278L286 362H230L236 320Z" fill="#4A4E55" />
                <path d="M278 320H292L302 362H286L278 320Z" fill="#B5BAC1" />
                <rect x="242" y="314" width="44" height="10" rx="2" fill="#32363C" />

                {/* Back Display Panel (angled right) */}
                <path
                    d="M322 240L358 308C361 314 357 322 350 322H302L322 240Z"
                    fill="#676C75"
                />
                <path
                    d="M324 252L349 306C351 310 348 315 343 315H310L324 252Z"
                    fill="#383C42"
                />

                {/* Front Display Housing */}
                <path
                    d="M214 246C216 240 222 236 228 236H316C324 236 329 243 326 250L306 312C304 318 298 322 292 322H204C196 322 191 315 194 308L214 246Z"
                    fill="url(#screenBezelGrad)"
                />

                {/* Front White Touchscreen */}
                <path
                    d="M222 252C223.5 248 227 245 231.5 245H309C314 245 317 249.5 315.5 254L299.5 304C298 308 294.5 311 290 311H212.5C207.5 311 204.5 306.5 206 302L222 252Z"
                    fill="#FFFFFF"
                />
                {/* Subtle Screen Glare */}
                <path
                    d="M228 250H264L246 306H212L228 250Z"
                    fill="#F1F5F9"
                    opacity="0.45"
                />
            </g>

            {/* Wooden Cashier Counter */}
            <g>
                {/* Counter Front Panel */}
                <rect x="132" y="408" width="508" height="112" fill="url(#counterBodyGrad)" />
                {/* Shadow Under Counter Top */}
                <rect x="132" y="408" width="508" height="10" fill="#E9AE83" opacity="0.65" />
                {/* Counter Top Slab */}
                <path
                    d="M126 390H640V410H126C120.5 410 116 405.5 116 400C116 394.5 120.5 390 126 390Z"
                    fill="url(#counterTopGrad)"
                />
                {/* Counter Top Highlight */}
                <path
                    d="M126 390H640V394H126C122.5 394 119.5 395.5 117.8 397.8C118.8 393.3 122.1 390 126 390Z"
                    fill="#DD9B70"
                    opacity="0.7"
                />
            </g>
        </svg>
    );
}
