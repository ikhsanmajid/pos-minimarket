<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan Penjualan {{ $period['start_date'] }} s.d. {{ $period['end_date'] }}</title>
    <style>
        @page { margin: 22px 26px; }
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, Arial, Helvetica, sans-serif; font-size: 9.5px; color: #1f2937; line-height: 1.4; margin: 0; padding: 0; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-muted { color: #6b7280; }
        .font-bold { font-weight: bold; }
        .text-rose { color: #be123c; }
        .text-emerald { color: #047857; }
        .header-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 12px; }
        .store-logo { max-height: 44px; max-width: 110px; margin-right: 10px; vertical-align: middle; }
        .company-name { font-size: 16px; font-weight: bold; color: #111827; margin: 0 0 2px 0; }
        .doc-title { font-size: 13px; font-weight: bold; color: #1d4ed8; letter-spacing: 0.4px; margin: 0; }
        .doc-period { font-size: 10px; font-weight: bold; color: #111827; margin: 3px 0 0 0; }
        .kpi-table { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin: 0 -6px 12px -6px; }
        .kpi-box { width: 25%; border: 1px solid #e5e7eb; background-color: #f9fafb; padding: 7px 9px; vertical-align: top; }
        .kpi-label { font-size: 8px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 3px; }
        .kpi-value { font-size: 12px; font-weight: bold; color: #111827; }
        .kpi-sub { font-size: 8px; color: #6b7280; margin-top: 2px; }
        .section-title { font-size: 10px; font-weight: bold; color: #111827; text-transform: uppercase; letter-spacing: 0.3px; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin: 12px 0 6px 0; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .items-table thead th { background-color: #111827; color: #ffffff; font-size: 8.5px; font-weight: bold; padding: 5px 6px; border: 1px solid #111827; }
        .items-table tbody td { padding: 5px 6px; border: 1px solid #e5e7eb; vertical-align: top; }
        .items-table tbody tr:nth-child(even) { background-color: #f9fafb; }
        .two-col { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .two-col > tbody > tr > td { width: 50%; vertical-align: top; }
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
                            @if($store->store_address)
                                <div class="text-muted" style="font-size: 8.5px;">{{ $store->store_address }}</div>
                            @endif
                            @if($store->store_phone)
                                <div class="text-muted" style="font-size: 8.5px;">Telp: {{ $store->store_phone }}</div>
                            @endif
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 40%; vertical-align: top;" class="text-right">
                <p class="doc-title">LAPORAN PENJUALAN</p>
                <p class="doc-period">Periode: {{ $period['start_date'] }} s.d. {{ $period['end_date'] }}</p>
                <div class="text-muted" style="font-size: 8.5px;">({{ $period['label'] }})</div>
            </td>
        </tr>
    </table>

    <table class="kpi-table">
        <tr>
            <td class="kpi-box">
                <div class="kpi-label">Omzet Bersih</div>
                <div class="kpi-value">{{ $rp($summary['net_sales']) }}</div>
                <div class="kpi-sub">Kotor: {{ $rp($summary['gross_sales']) }}</div>
            </td>
            <td class="kpi-box">
                <div class="kpi-label">Transaksi Valid</div>
                <div class="kpi-value">{{ $num($summary['transactions_count']) }} trx</div>
                <div class="kpi-sub">{{ $num($summary['total_items_sold']) }} unit terjual</div>
            </td>
            <td class="kpi-box">
                <div class="kpi-label">Rata-rata (AOV)</div>
                <div class="kpi-value">{{ $rp($summary['average_order_value']) }}</div>
                <div class="kpi-sub">Diskon: {{ $rp($summary['total_discount']) }} | PPN: {{ $rp($summary['total_tax']) }}</div>
            </td>
            <td class="kpi-box">
                <div class="kpi-label">Total Retur</div>
                <div class="kpi-value text-rose">{{ $rp($summary['total_returns']) }}</div>
                <div class="kpi-sub">Transaksi void dikecualikan</div>
            </td>
        </tr>
    </table>

    <table class="two-col">
        <tr>
            <td style="padding-right: 6px;">
                <div class="section-title">Breakdown Metode Pembayaran</div>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th class="text-left">Metode</th>
                            <th class="text-right">Trx</th>
                            <th class="text-right">Nominal</th>
                            <th class="text-right">Porsi</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($paymentBreakdown as $pm)
                            <tr>
                                <td class="font-bold">{{ $pm['label'] }}</td>
                                <td class="text-right">{{ $num($pm['count']) }}</td>
                                <td class="text-right">{{ $rp($pm['amount']) }}</td>
                                <td class="text-right">{{ $pm['percentage'] }}%</td>
                            </tr>
                        @empty
                            <tr><td colspan="4" class="text-center text-muted">Tidak ada data pembayaran.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </td>
            <td style="padding-left: 6px;">
                <div class="section-title">Breakdown per Kasir</div>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th class="text-left">Kasir</th>
                            <th class="text-right">Trx</th>
                            <th class="text-right">Retur</th>
                            <th class="text-right">Omzet Bersih</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($cashierBreakdown as $cb)
                            <tr>
                                <td class="font-bold">{{ $cb['cashier_name'] }}</td>
                                <td class="text-right">{{ $num($cb['transactions_count']) }}</td>
                                <td class="text-right text-rose">{{ $rp($cb['returns_amount']) }}</td>
                                <td class="text-right font-bold">{{ $rp($cb['net_sales']) }}</td>
                            </tr>
                        @empty
                            <tr><td colspan="4" class="text-center text-muted">Tidak ada data kasir.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </td>
        </tr>
    </table>

    <div class="section-title">Rincian Penjualan per Produk</div>
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 5%;" class="text-center">No</th>
                <th style="width: 31%;" class="text-left">Produk & Barcode</th>
                <th style="width: 15%;" class="text-left">Kategori</th>
                <th style="width: 9%;" class="text-right">Qty</th>
                <th style="width: 8%;" class="text-right">Retur</th>
                <th style="width: 15%;" class="text-right">Omzet Kotor</th>
                <th style="width: 17%;" class="text-right">Omzet Bersih</th>
            </tr>
        </thead>
        <tbody>
            @forelse($products as $idx => $item)
                <tr>
                    <td class="text-center">{{ $idx + 1 }}</td>
                    <td>
                        <div class="font-bold">{{ $item['product_name'] }}</div>
                        <div class="text-muted" style="font-size: 8px;">{{ $item['barcode'] }} ({{ $item['base_unit'] }})</div>
                    </td>
                    <td>{{ $item['category_name'] }}</td>
                    <td class="text-right">{{ $num($item['qty_sold']) }}</td>
                    <td class="text-right text-rose">{{ $num($item['qty_returned']) }}</td>
                    <td class="text-right">{{ $rp($item['total_revenue']) }}</td>
                    <td class="text-right font-bold">{{ $rp($item['net_revenue']) }}</td>
                </tr>
            @empty
                <tr><td colspan="7" class="text-center text-muted">Tidak ada transaksi pada periode terpilih.</td></tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        Dicetak oleh: <strong>{{ $printedBy }}</strong> pada {{ $printedAt }} &bull; {{ $store->store_name }}
    </div>
</body>
</html>
