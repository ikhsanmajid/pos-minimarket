<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan Valuasi &amp; Pergerakan Stok {{ $period['start_date'] }} s.d. {{ $period['end_date'] }}</title>
    <style>
        @page { margin: 20px 24px; }
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, Arial, Helvetica, sans-serif; font-size: 9px; color: #1f2937; line-height: 1.4; margin: 0; padding: 0; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-muted { color: #6b7280; }
        .font-bold { font-weight: bold; }
        .header-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 12px; }
        .store-logo { max-height: 40px; max-width: 100px; margin-right: 10px; }
        .company-name { font-size: 15px; font-weight: bold; color: #111827; margin: 0 0 2px 0; }
        .doc-title { font-size: 13px; font-weight: bold; color: #1e3a8a; margin: 0; }
        .doc-period { font-size: 9.5px; font-weight: bold; color: #111827; margin: 3px 0 0 0; }
        .kpi-table { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin: 0 -6px 12px -6px; }
        .kpi-box { width: 25%; border: 1px solid #e5e7eb; background-color: #f9fafb; padding: 7px 9px; vertical-align: top; }
        .kpi-label { font-size: 8px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 3px; }
        .kpi-value { font-size: 12px; font-weight: bold; color: #111827; }
        .kpi-sub { font-size: 8px; color: #6b7280; margin-top: 2px; }
        .section-title { font-size: 9.5px; font-weight: bold; color: #111827; text-transform: uppercase; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin: 10px 0 6px 0; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .items-table thead th { background-color: #1e3a8a; color: #ffffff; font-size: 8.5px; font-weight: bold; padding: 5px 6px; border: 1px solid #1e3a8a; }
        .items-table tbody td { padding: 4.5px 6px; border: 1px solid #e5e7eb; vertical-align: top; }
        .items-table tbody tr:nth-child(even) { background-color: #f9fafb; }
        .badge { display: inline-block; padding: 1.5px 5px; border-radius: 3px; font-size: 7.5px; font-weight: bold; }
        .badge-fast_moving { background-color: #d1fae5; color: #065f46; }
        .badge-slow_moving { background-color: #fef3c7; color: #92400e; }
        .badge-dead_stock { background-color: #ffe4e6; color: #9f1239; }
        .badge-out_of_stock { background-color: #f1f5f9; color: #475569; }
        .footer { margin-top: 14px; border-top: 1px solid #e5e7eb; padding-top: 6px; font-size: 8px; color: #6b7280; }
    </style>
</head>
<body>
    @php
        $rp = fn ($v) => 'Rp ' . number_format((float) $v, 0, ',', '.');
        $num = fn ($v) => number_format((float) $v, 0, ',', '.');
    @endphp

    <table class="header-table">
        <tr>
            <td style="width: 60%; vertical-align: top;">
                <table style="border-collapse: collapse;">
                    <tr>
                        @if($logoDataUri)
                            <td style="vertical-align: top;"><img src="{{ $logoDataUri }}" alt="Logo" class="store-logo"></td>
                        @endif
                        <td style="vertical-align: top;">
                            <p class="company-name">{{ $store->store_name }}</p>
                            @if($store->store_address)<div class="text-muted" style="font-size: 8px;">{{ $store->store_address }}</div>@endif
                            @if($store->store_phone)<div class="text-muted" style="font-size: 8px;">Telp: {{ $store->store_phone }}</div>@endif
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 40%; vertical-align: top;" class="text-right">
                <p class="doc-title">LAPORAN VALUASI &amp; PERGERAKAN STOK</p>
                <p class="doc-period">Periode Evaluasi: {{ $period['start_date'] }} s.d. {{ $period['end_date'] }}</p>
                <div class="text-muted" style="font-size: 8px;">Ambang Fast-Moving: &ge; {{ $summary['fast_moving_threshold'] }} unit</div>
            </td>
        </tr>
    </table>

    <table class="kpi-table">
        <tr>
            <td class="kpi-box">
                <div class="kpi-label">Total Nilai Aset (HPP)</div>
                <div class="kpi-value">{{ $rp($summary['total_asset_value']) }}</div>
                <div class="kpi-sub">{{ $num($summary['total_skus']) }} SKU aktif</div>
            </td>
            <td class="kpi-box">
                <div class="kpi-label">Potensi Nilai Jual</div>
                <div class="kpi-value">{{ $rp($summary['total_potential_sales']) }}</div>
                <div class="kpi-sub">Potensi Laba: {{ $rp($summary['total_potential_profit']) }}</div>
            </td>
            <td class="kpi-box">
                <div class="kpi-label">Fast Moving</div>
                <div class="kpi-value">{{ $num($summary['fast_moving_count']) }} SKU</div>
                <div class="kpi-sub">Slow Moving: {{ $num($summary['slow_moving_count']) }} SKU</div>
            </td>
            <td class="kpi-box">
                <div class="kpi-label">Dead Stock</div>
                <div class="kpi-value" style="color: #be123c;">{{ $num($summary['dead_stock_count']) }} SKU</div>
                <div class="kpi-sub">Stok Habis: {{ $num($summary['out_of_stock_count']) }} SKU</div>
            </td>
        </tr>
    </table>

    <div class="section-title">Valuasi &amp; Klasifikasi Pergerakan per Produk</div>
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 4%;" class="text-center">No</th>
                <th style="width: 12%;" class="text-left">Barcode</th>
                <th style="width: 24%;" class="text-left">Nama Produk</th>
                <th style="width: 13%;" class="text-left">Kategori</th>
                <th style="width: 8%;" class="text-right">Stok</th>
                <th style="width: 11%;" class="text-right">HPP</th>
                <th style="width: 12%;" class="text-right">Nilai Aset</th>
                <th style="width: 7%;" class="text-right">Terjual</th>
                <th style="width: 9%;" class="text-center">Status</th>
            </tr>
        </thead>
        <tbody>
            @forelse($products as $idx => $item)
                <tr>
                    <td class="text-center">{{ $idx + 1 }}</td>
                    <td>{{ $item['barcode'] }}</td>
                    <td class="font-bold">{{ $item['product_name'] }}</td>
                    <td>{{ $item['category_name'] }}</td>
                    <td class="text-right">{{ $num($item['stock']) }} {{ $item['base_unit'] }}</td>
                    <td class="text-right">{{ $rp($item['buy_price']) }}</td>
                    <td class="text-right font-bold">{{ $rp($item['asset_value']) }}</td>
                    <td class="text-right">{{ $num($item['qty_sold']) }}</td>
                    <td class="text-center"><span class="badge badge-{{ $item['movement_class'] }}">{{ $item['movement_label'] }}</span></td>
                </tr>
            @empty
                <tr><td colspan="9" class="text-center text-muted">Tidak ada produk yang cocok dengan filter.</td></tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        Dicetak oleh: <strong>{{ $printedBy }}</strong> pada {{ $printedAt }} &bull; {{ $store->store_name }}
    </div>
</body>
</html>
