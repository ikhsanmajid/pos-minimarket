<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Laporan Keuangan &amp; Aging Hutang {{ $period['start_date'] }} s.d. {{ $period['end_date'] }}</title>
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
        .doc-title { font-size: 13px; font-weight: bold; color: #111827; margin: 0; }
        .doc-period { font-size: 10px; font-weight: bold; color: #111827; margin: 3px 0 0 0; }
        .kpi-table { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin: 0 -6px 12px -6px; }
        .kpi-box { width: 25%; border: 1px solid #e5e7eb; background-color: #f9fafb; padding: 7px 9px; vertical-align: top; }
        .kpi-label { font-size: 8px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 3px; }
        .kpi-value { font-size: 12px; font-weight: bold; color: #111827; }
        .kpi-sub { font-size: 8px; color: #6b7280; margin-top: 2px; }
        .section-title { font-size: 10px; font-weight: bold; color: #111827; text-transform: uppercase; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin: 12px 0 6px 0; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .items-table thead th { background-color: #111827; color: #ffffff; font-size: 8.5px; font-weight: bold; padding: 5px 6px; border: 1px solid #111827; }
        .items-table tbody td { padding: 5px 6px; border: 1px solid #e5e7eb; vertical-align: top; }
        .items-table tbody tr:nth-child(even) { background-color: #f9fafb; }
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
                <p class="doc-title">LAPORAN KEUANGAN &amp; AGING HUTANG</p>
                <p class="doc-period">Periode: {{ $period['start_date'] }} s.d. {{ $period['end_date'] }}</p>
                <div class="text-muted" style="font-size: 8.5px;">Posisi Aging per {{ now()->format('d M Y') }}</div>
            </td>
        </tr>
    </table>

    <table class="kpi-table">
        <tr>
            <td class="kpi-box">
                <div class="kpi-label">Total Pemasukan</div>
                <div class="kpi-value text-emerald">{{ $rp($summary['total_income']) }}</div>
                <div class="kpi-sub">Saldo Kas/Bank: {{ $rp($summary['total_account_balance']) }}</div>
            </td>
            <td class="kpi-box">
                <div class="kpi-label">Arus Kas Bersih</div>
                <div class="kpi-value {{ $summary['net_cashflow'] < 0 ? 'text-rose' : 'text-emerald' }}">{{ $rp($summary['net_cashflow']) }}</div>
                <div class="kpi-sub">Pemasukan - Pengeluaran</div>
            </td>
            <td class="kpi-box">
                <div class="kpi-label">Total Pengeluaran</div>
                <div class="kpi-value">{{ $rp($summary['total_expense']) }}</div>
                <div class="kpi-sub">Periode {{ $period['label'] }}</div>
            </td>
            <td class="kpi-box">
                <div class="kpi-label">Hutang Jatuh Tempo</div>
                <div class="kpi-value text-rose">{{ $rp($summary['total_overdue_amount']) }}</div>
                <div class="kpi-sub">{{ $num($summary['overdue_count']) }} faktur | Total AP: {{ $rp($summary['total_ap_remaining']) }}</div>
            </td>
        </tr>
    </table>

    <div class="section-title">Arus Kas per Kategori</div>
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 14%;" class="text-left">Kode</th>
                <th style="width: 38%;" class="text-left">Kategori Keuangan</th>
                <th style="width: 10%;" class="text-right">Trx</th>
                <th style="width: 19%;" class="text-right">Pemasukan</th>
                <th style="width: 19%;" class="text-right">Pengeluaran</th>
            </tr>
        </thead>
        <tbody>
            @forelse($cashflowCategories as $cat)
                <tr>
                    <td class="font-bold">{{ $cat['code'] }}</td>
                    <td>{{ $cat['name'] }}</td>
                    <td class="text-right">{{ $num($cat['transactions_count']) }}</td>
                    <td class="text-right text-emerald">{{ $cat['income'] > 0 ? $rp($cat['income']) : '-' }}</td>
                    <td class="text-right text-rose">{{ $cat['expense'] > 0 ? $rp($cat['expense']) : '-' }}</td>
                </tr>
            @empty
                <tr><td colspan="5" class="text-center text-muted">Tidak ada transaksi arus kas pada periode ini.</td></tr>
            @endforelse
        </tbody>
    </table>

    <div class="section-title">Aging Hutang per Supplier</div>
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 24%;" class="text-left">Supplier</th>
                <th style="width: 13%;" class="text-right">Current</th>
                <th style="width: 13%;" class="text-right">1-30 Hr</th>
                <th style="width: 12%;" class="text-right">31-60 Hr</th>
                <th style="width: 12%;" class="text-right">61-90 Hr</th>
                <th style="width: 12%;" class="text-right">&gt; 90 Hr</th>
                <th style="width: 14%;" class="text-right">Total</th>
            </tr>
        </thead>
        <tbody>
            @forelse($supplierAging as $sup)
                <tr>
                    <td class="font-bold">{{ $sup['supplier_name'] }}</td>
                    <td class="text-right">{{ $rp($sup['current']) }}</td>
                    <td class="text-right">{{ $rp($sup['days_1_30']) }}</td>
                    <td class="text-right">{{ $rp($sup['days_31_60']) }}</td>
                    <td class="text-right">{{ $rp($sup['days_61_90']) }}</td>
                    <td class="text-right text-rose">{{ $rp($sup['over_90']) }}</td>
                    <td class="text-right font-bold">{{ $rp($sup['total']) }}</td>
                </tr>
            @empty
                <tr><td colspan="7" class="text-center text-muted">Tidak ada hutang dagang yang belum lunas.</td></tr>
            @endforelse
        </tbody>
    </table>

    <div class="section-title">Daftar Faktur Hutang Jatuh Tempo (Overdue)</div>
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 18%;" class="text-left">No. Hutang / PO</th>
                <th style="width: 28%;" class="text-left">Supplier</th>
                <th style="width: 14%;" class="text-center">Jatuh Tempo</th>
                <th style="width: 18%;" class="text-center">Terlambat</th>
                <th style="width: 22%;" class="text-right">Sisa Hutang</th>
            </tr>
        </thead>
        <tbody>
            @forelse($overduePayables as $ap)
                <tr>
                    <td>
                        <div class="font-bold">{{ $ap['payable_number'] }}</div>
                        <div class="text-muted" style="font-size: 8px;">{{ $ap['po_number'] }}</div>
                    </td>
                    <td>{{ $ap['supplier_name'] }}</td>
                    <td class="text-center">{{ $ap['due_date'] }}</td>
                    <td class="text-center text-rose font-bold">{{ $ap['days_overdue'] }} hari ({{ $ap['aging_bucket'] }})</td>
                    <td class="text-right font-bold">{{ $rp($ap['remaining_amount']) }}</td>
                </tr>
            @empty
                <tr><td colspan="5" class="text-center text-muted">Tidak ada faktur hutang yang melewati jatuh tempo.</td></tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        Dicetak oleh: <strong>{{ $printedBy }}</strong> pada {{ $printedAt }} &bull; {{ $store->store_name }}
    </div>
</body>
</html>
