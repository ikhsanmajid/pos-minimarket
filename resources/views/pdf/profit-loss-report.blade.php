<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan Laba Kotor (HPP) {{ $period['start_date'] }} s.d. {{ $period['end_date'] }}</title>
    <style>
        @page { margin: 22px 26px; }
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, Arial, Helvetica, sans-serif; font-size: 9.5px; color: #1f2937; line-height: 1.4; margin: 0; padding: 0; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-muted { color: #6b7280; }
        .font-bold { font-weight: bold; }
        .text-emerald { color: #047857; }
        .text-rose { color: #be123c; }
        .header-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 12px; }
        .store-logo { max-height: 44px; max-width: 110px; margin-right: 10px; }
        .company-name { font-size: 16px; font-weight: bold; color: #111827; margin: 0 0 2px 0; }
        .doc-title { font-size: 13px; font-weight: bold; color: #047857; letter-spacing: 0.4px; margin: 0; }
        .doc-period { font-size: 10px; font-weight: bold; color: #111827; margin: 3px 0 0 0; }
        .kpi-table { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin: 0 -6px 12px -6px; }
        .kpi-box { width: 25%; border: 1px solid #e5e7eb; background-color: #f9fafb; padding: 7px 9px; vertical-align: top; }
        .kpi-label { font-size: 8px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 3px; }
        .kpi-value { font-size: 12px; font-weight: bold; color: #111827; }
        .kpi-sub { font-size: 8px; color: #6b7280; margin-top: 2px; }
        .section-title { font-size: 10px; font-weight: bold; color: #111827; text-transform: uppercase; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin: 12px 0 6px 0; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .items-table thead th { background-color: #065f46; color: #ffffff; font-size: 8.5px; font-weight: bold; padding: 5px 6px; border: 1px solid #065f46; }
        .items-table tbody td { padding: 5px 6px; border: 1px solid #e5e7eb; vertical-align: top; }
        .items-table tbody tr:nth-child(even) { background-color: #f9fafb; }
        .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .summary-table td { padding: 5px 8px; border: 1px solid #e5e7eb; }
        .summary-highlight { background-color: #f3f4f6; font-weight: bold; }
        .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 6px; font-size: 8px; color: #6b7280; }
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
                            @if($store->store_address)<div class="text-muted" style="font-size: 8.5px;">{{ $store->store_address }}</div>@endif
                            @if($store->store_phone)<div class="text-muted" style="font-size: 8.5px;">Telp: {{ $store->store_phone }}</div>@endif
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 40%; vertical-align: top;" class="text-right">
                <p class="doc-title">LAPORAN LABA KOTOR &amp; HPP</p>
                <p class="doc-period">Periode: {{ $period['start_date'] }} s.d. {{ $period['end_date'] }}</p>
                <div class="text-muted" style="font-size: 8.5px;">Basis HPP: Snapshot Harga Beli Historis</div>
            </td>
        </tr>
    </table>

    <table class="kpi-table">
        <tr>
            <td class="kpi-box">
                <div class="kpi-label">Omzet Bersih (Excl. PPN)</div>
                <div class="kpi-value">{{ $rp($summary['net_revenue']) }}</div>
                <div class="kpi-sub">Retur: -{{ $rp($summary['total_returns']) }}</div>
            </td>
            <td class="kpi-box">
                <div class="kpi-label">Laba Kotor &amp; Margin</div>
                <div class="kpi-value text-emerald">{{ $rp($summary['gross_profit']) }}</div>
                <div class="kpi-sub">Margin: {{ number_format((float) $summary['gross_margin_pct'], 2, ',', '.') }}%</div>
            </td>
            <td class="kpi-box">
                <div class="kpi-label">HPP Bersih (COGS)</div>
                <div class="kpi-value">{{ $rp($summary['net_cogs']) }}</div>
                <div class="kpi-sub">Restock Retur: -{{ $rp($summary['restockable_return_cogs']) }}</div>
            </td>
            <td class="kpi-box">
                <div class="kpi-label">Kerugian Stok (Shrinkage)</div>
                <div class="kpi-value text-rose">{{ $rp($summary['total_shrinkage']) }}</div>
                <div class="kpi-sub">Adj: {{ $rp($summary['adjustment_loss']) }} | Opname: {{ $rp($summary['opname_loss']) }}</div>
            </td>
        </tr>
    </table>

    <div class="section-title">Ringkasan Estimasi Laba Operasional</div>
    <table class="summary-table">
        <tr>
            <td>Laba Kotor (Omzet Bersih - HPP Bersih)</td>
            <td class="text-right font-bold text-emerald">{{ $rp($summary['gross_profit']) }}</td>
        </tr>
        <tr>
            <td>Dampak Kerugian Stok / Shrinkage (Adjustment Rusak/Hilang + Opname Minus)</td>
            <td class="text-right text-rose">- {{ $rp($summary['total_shrinkage']) }}</td>
        </tr>
        <tr>
            <td>Pengeluaran Operasional (Non-Pembelian Stok)</td>
            <td class="text-right text-rose">- {{ $rp($summary['operational_expense']) }}</td>
        </tr>
        <tr class="summary-highlight">
            <td>Estimasi Laba Bersih Operasional</td>
            <td class="text-right {{ $summary['estimated_operating_profit'] < 0 ? 'text-rose' : 'text-emerald' }}">{{ $rp($summary['estimated_operating_profit']) }}</td>
        </tr>
    </table>

    <div class="section-title">Rincian Laba Kotor per Produk</div>
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 5%;" class="text-center">No</th>
                <th style="width: 28%;" class="text-left">Produk</th>
                <th style="width: 14%;" class="text-left">Kategori</th>
                <th style="width: 8%;" class="text-right">Qty</th>
                <th style="width: 14%;" class="text-right">Omzet Bersih</th>
                <th style="width: 13%;" class="text-right">HPP Bersih</th>
                <th style="width: 11%;" class="text-right">Laba Kotor</th>
                <th style="width: 7%;" class="text-right">Margin</th>
            </tr>
        </thead>
        <tbody>
            @forelse($products as $idx => $item)
                <tr>
                    <td class="text-center">{{ $idx + 1 }}</td>
                    <td>
                        <div class="font-bold">{{ $item['product_name'] }}</div>
                        <div class="text-muted" style="font-size: 8px;">{{ $item['barcode'] }}</div>
                    </td>
                    <td>{{ $item['category_name'] }}</td>
                    <td class="text-right">{{ $num($item['qty_sold']) }}</td>
                    <td class="text-right">{{ $rp($item['net_revenue']) }}</td>
                    <td class="text-right">{{ $rp($item['net_cogs']) }}</td>
                    <td class="text-right font-bold {{ $item['gross_profit'] < 0 ? 'text-rose' : 'text-emerald' }}">{{ $rp($item['gross_profit']) }}</td>
                    <td class="text-right">{{ number_format((float) $item['margin_pct'], 1, ',', '.') }}%</td>
                </tr>
            @empty
                <tr><td colspan="8" class="text-center text-muted">Tidak ada data penjualan pada periode terpilih.</td></tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        Dicetak oleh: <strong>{{ $printedBy }}</strong> pada {{ $printedAt }} &bull; {{ $store->store_name }}
    </div>
</body>
</html>
