<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan Stock Opname {{ $opname->opname_number }}</title>
    <style>
        @page { margin: 24px 28px; }
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, Arial, Helvetica, sans-serif; font-size: 10px; color: #1f2937; line-height: 1.45; margin: 0; padding: 0; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-muted { color: #6b7280; }
        .font-bold { font-weight: bold; }
        .text-emerald { color: #047857; }
        .text-rose { color: #be123c; }
        .header-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 14px; }
        .company-name { font-size: 17px; font-weight: bold; color: #111827; margin: 0 0 2px 0; }
        .doc-title { font-size: 13px; font-weight: bold; color: #1d4ed8; letter-spacing: 0.4px; margin: 0; }
        .doc-number { font-size: 12px; font-weight: bold; color: #111827; margin: 3px 0 0 0; }
        .info-table { width: 100%; margin-bottom: 14px; border-collapse: collapse; }
        .info-box { vertical-align: top; width: 50%; border: 1px solid #e5e7eb; background-color: #f9fafb; padding: 8px 10px; }
        .info-box-title { font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 5px; }
        .meta-row { width: 100%; border-collapse: collapse; }
        .meta-row td { padding: 1.5px 0; vertical-align: top; }
        .meta-label { width: 115px; color: #6b7280; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        .items-table thead th { background-color: #1e3a8a; color: #ffffff; font-size: 9px; font-weight: bold; padding: 6px 6px; border: 1px solid #1e3a8a; }
        .items-table tbody td { padding: 5px 6px; border: 1px solid #e5e7eb; vertical-align: top; }
        .items-table tbody tr:nth-child(even) { background-color: #f9fafb; }
        .summary-box { border: 1px solid #e5e7eb; background-color: #f9fafb; padding: 9px 11px; margin-bottom: 18px; }
        .signature-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .signature-table td { width: 50%; text-align: center; vertical-align: top; padding: 0 24px; }
        .signature-space { height: 48px; }
        .signature-line { border-top: 1px solid #9ca3af; padding-top: 4px; font-weight: bold; }
        .footer { margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 6px; font-size: 8.5px; color: #9ca3af; text-align: right; }
    </style>
</head>
<body>
    <table class="header-table">
        <tr>
            <td style="width: 55%; vertical-align: top;">
                <p class="company-name">{{ config('app.name', 'POS Minimarket') }}</p>
                <div class="text-muted" style="font-size: 9px;">Berita Acara & Laporan Hasil Stock Opname</div>
            </td>
            <td style="width: 45%; vertical-align: top;" class="text-right">
                <p class="doc-title">LAPORAN STOCK OPNAME</p>
                <p class="doc-number">{{ $opname->opname_number }}</p>
            </td>
        </tr>
    </table>

    <table class="info-table">
        <tr>
            <td class="info-box" style="border-right: none;">
                <div class="info-box-title">Informasi Sesi</div>
                <table class="meta-row">
                    <tr><td class="meta-label">Cakupan</td><td class="font-bold">: {{ $opname->category?->name ?? 'Seluruh Toko' }}</td></tr>
                    <tr><td class="meta-label">Mode Hitung</td><td>: {{ $opname->is_blind_count ? 'Blind Count' : 'Standar' }}</td></tr>
                    <tr><td class="meta-label">Mulai</td><td>: {{ $opname->started_at?->format('d M Y H:i') ?? '-' }}</td></tr>
                    <tr><td class="meta-label">Selesai</td><td>: {{ $opname->completed_at?->format('d M Y H:i') ?? '-' }}</td></tr>
                </table>
            </td>
            <td class="info-box">
                <div class="info-box-title">Penanggung Jawab & Ringkasan</div>
                <table class="meta-row">
                    <tr><td class="meta-label">Dibuat Oleh</td><td>: {{ $opname->creator?->name ?? 'Sistem' }}</td></tr>
                    <tr><td class="meta-label">Disetujui Oleh</td><td class="font-bold">: {{ $opname->approver?->name ?? '-' }}</td></tr>
                    <tr><td class="meta-label">Item Dihitung</td><td>: {{ number_format((int) $opname->total_items_counted, 0, ',', '.') }} produk ({{ (int) $opname->total_variance_items }} berselisih)</td></tr>
                    <tr>
                        <td class="meta-label">Total Selisih (Rp)</td>
                        <td class="font-bold {{ (float) $opname->total_variance_value < 0 ? 'text-rose' : ((float) $opname->total_variance_value > 0 ? 'text-emerald' : '') }}">
                            : Rp {{ number_format((float) $opname->total_variance_value, 0, ',', '.') }}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 5%;" class="text-center">No</th>
                <th style="width: 31%;" class="text-left">Produk & Barcode</th>
                <th style="width: 11%;" class="text-right">Stok Sistem</th>
                <th style="width: 11%;" class="text-right">Stok Fisik</th>
                <th style="width: 10%;" class="text-right">Selisih</th>
                <th style="width: 15%;" class="text-right">Selisih Nilai (Rp)</th>
                <th style="width: 17%;" class="text-left">Catatan</th>
            </tr>
        </thead>
        <tbody>
            @foreach($opname->items as $index => $item)
                @php
                    $varQty = (int) $item->variance_qty;
                    $varVal = (float) $item->variance_value;
                @endphp
                <tr>
                    <td class="text-center">{{ $index + 1 }}</td>
                    <td>
                        <div class="font-bold">{{ $item->product?->name ?? 'Produk Dihapus' }}</div>
                        <div class="text-muted" style="font-size: 8.5px;">{{ $item->product?->barcode ?? '-' }} ({{ $item->product?->base_unit ?: 'pcs' }})</div>
                    </td>
                    <td class="text-right">{{ number_format((int) $item->system_stock, 0, ',', '.') }}</td>
                    <td class="text-right font-bold">{{ number_format((int) ($item->physical_stock ?? 0), 0, ',', '.') }}</td>
                    <td class="text-right font-bold {{ $varQty < 0 ? 'text-rose' : ($varQty > 0 ? 'text-emerald' : 'text-muted') }}">
                        {{ $varQty > 0 ? '+' . $varQty : $varQty }}
                    </td>
                    <td class="text-right font-bold {{ $varVal < 0 ? 'text-rose' : ($varVal > 0 ? 'text-emerald' : 'text-muted') }}">
                        Rp {{ number_format($varVal, 0, ',', '.') }}
                    </td>
                    <td>{{ $item->notes ?: '-' }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    @if($opname->notes)
        <div class="summary-box">
            <div class="font-bold" style="margin-bottom: 3px;">Catatan Sesi:</div>
            <div>{{ $opname->notes }}</div>
        </div>
    @endif

    <table class="signature-table">
        <tr>
            <td>
                <div>Penghitung / Pembuat Sesi</div>
                <div class="signature-space"></div>
                <div class="signature-line">{{ $opname->creator?->name ?? '...........................' }}</div>
            </td>
            <td>
                <div>Disetujui & Difinalisasi Oleh</div>
                <div class="signature-space"></div>
                <div class="signature-line">{{ $opname->approver?->name ?? '...........................' }}</div>
            </td>
        </tr>
    </table>

    <div class="footer">
        Dicetak pada {{ now()->format('d M Y H:i') }} — {{ config('app.name', 'POS Minimarket') }}
    </div>
</body>
</html>
