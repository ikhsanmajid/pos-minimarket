<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Purchase Order {{ $purchaseOrder->po_number }}</title>
    <style>
        @page { margin: 24px 28px; }
        * { box-sizing: border-box; }
        body { font-family: DejaVu Sans, Arial, Helvetica, sans-serif; font-size: 10.5px; color: #1f2937; line-height: 1.45; margin: 0; padding: 0; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-muted { color: #6b7280; }
        .font-bold { font-weight: bold; }
        .header-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
        .company-name { font-size: 18px; font-weight: bold; color: #111827; margin: 0 0 2px 0; }
        .doc-title { font-size: 15px; font-weight: bold; color: #1d4ed8; letter-spacing: 0.5px; margin: 0; }
        .po-number { font-size: 13px; font-weight: bold; color: #111827; margin: 3px 0 6px 0; }
        .badge { display: inline-block; padding: 2px 7px; border-radius: 3px; font-size: 8.5px; font-weight: bold; text-transform: uppercase; border: 1px solid #d1d5db; background-color: #f3f4f6; color: #374151; margin-left: 3px; }
        .badge-draft { background-color: #f1f5f9; color: #334155; border-color: #cbd5e1; }
        .badge-pending_approval { background-color: #fef3c7; color: #92400e; border-color: #fcd34d; }
        .badge-approved { background-color: #dbeafe; color: #1e40af; border-color: #93c5fd; }
        .badge-rejected { background-color: #ffe4e6; color: #9f1239; border-color: #fda4af; }
        .badge-cancelled { background-color: #ffe4e6; color: #9f1239; border-color: #fda4af; }
        .badge-unreceived { background-color: #f1f5f9; color: #475569; border-color: #cbd5e1; }
        .badge-partial { background-color: #fef3c7; color: #92400e; border-color: #fcd34d; }
        .badge-received { background-color: #d1fae5; color: #065f46; border-color: #6ee7b7; }
        .badge-paid { background-color: #d1fae5; color: #065f46; border-color: #6ee7b7; }
        .badge-unpaid { background-color: #ffe4e6; color: #9f1239; border-color: #fda4af; }
        .info-table { width: 100%; margin-bottom: 14px; border-collapse: separate; border-spacing: 0; }
        .info-box { vertical-align: top; width: 50%; border: 1px solid #e5e7eb; background-color: #f9fafb; padding: 9px 11px; }
        .info-box-title { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #6b7280; letter-spacing: 0.4px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 6px; }
        .meta-row { width: 100%; border-collapse: collapse; }
        .meta-row td { padding: 1.5px 0; vertical-align: top; }
        .meta-label { width: 108px; color: #6b7280; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
        .items-table thead th { background-color: #111827; color: #ffffff; font-size: 9.5px; font-weight: bold; padding: 6px 7px; border: 1px solid #111827; }
        .items-table tbody td { padding: 6px 7px; border: 1px solid #e5e7eb; vertical-align: top; }
        .items-table tbody tr:nth-child(even) { background-color: #f9fafb; }
        .product-name { font-weight: bold; color: #111827; }
        .product-meta { font-size: 9px; color: #6b7280; margin-top: 2px; }
        .summary-layout { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .notes-col { width: 54%; vertical-align: top; padding-right: 14px; }
        .totals-col { width: 46%; vertical-align: top; }
        .notes-box { border: 1px solid #e5e7eb; background-color: #f9fafb; padding: 9px 11px; min-height: 76px; }
        .totals-table { width: 100%; border-collapse: collapse; }
        .totals-table td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
        .totals-table tr.grand-total td { border-top: 2px solid #111827; border-bottom: 2px solid #111827; background-color: #f3f4f6; font-size: 12px; font-weight: bold; color: #111827; padding: 7px 8px; }
        .signature-table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .signature-table td { width: 33.33%; text-align: center; vertical-align: top; padding: 0 10px; }
        .signature-space { height: 50px; }
        .signature-line { border-top: 1px solid #9ca3af; padding-top: 4px; font-weight: bold; }
        .footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 6px; font-size: 8.5px; color: #9ca3af; text-align: right; }
    </style>
</head>
<body>
    @php
        $formatRupiah = fn ($val) => 'Rp ' . number_format((float) $val, 0, ',', '.');
        $discountVal = (float) ($purchaseOrder->discount_value ?? 0);
        $taxVal = (float) ($purchaseOrder->tax_value ?? $purchaseOrder->tax_percentage ?? 0);
        $discountLabel = ($purchaseOrder->discount_type === 'percent' && $discountVal > 0)
            ? 'Diskon Global (' . rtrim(rtrim(number_format($discountVal, 2, ',', '.'), '0'), ',') . '%)'
            : 'Diskon Global';
        $taxLabel = (($purchaseOrder->tax_type ?? 'percent') === 'percent' && $taxVal > 0)
            ? 'Pajak / PPN (' . rtrim(rtrim(number_format($taxVal, 2, ',', '.'), '0'), ',') . '%)'
            : 'Pajak / PPN';
    @endphp

    <table class="header-table">
        <tr>
            <td style="width: 52%; vertical-align: top;">
                <p class="company-name">{{ config('app.name', 'POS Minimarket') }}</p>
                <div class="text-muted" style="font-size: 9.5px;">Dokumen Pesanan Pembelian (Purchase Order)</div>
            </td>
            <td style="width: 48%; vertical-align: top;" class="text-right">
                <p class="doc-title">PURCHASE ORDER</p>
                <p class="po-number">{{ $purchaseOrder->po_number }}</p>
                <div>
                    <span class="badge badge-{{ $purchaseOrder->status->value }}">{{ $purchaseOrder->status->label() }}</span>
                    <span class="badge badge-{{ $purchaseOrder->receiving_status->value }}">{{ $purchaseOrder->receiving_status->label() }}</span>
                    <span class="badge badge-{{ $purchaseOrder->payment_status->value }}">{{ $purchaseOrder->payment_status->label() }}</span>
                </div>
            </td>
        </tr>
    </table>

    <table class="info-table">
        <tr>
            <td class="info-box" style="border-right: none;">
                <div class="info-box-title">Kepada (Supplier)</div>
                <div class="font-bold" style="font-size: 11.5px; margin-bottom: 4px;">
                    {{ $purchaseOrder->supplier?->name ?? '-' }}
                    @if($purchaseOrder->supplier?->code)
                        <span class="text-muted" style="font-weight: normal; font-size: 9.5px;">({{ $purchaseOrder->supplier->code }})</span>
                    @endif
                </div>
                <table class="meta-row">
                    @if($purchaseOrder->supplier?->contact_person)
                        <tr><td class="meta-label">PIC</td><td>: {{ $purchaseOrder->supplier->contact_person }}</td></tr>
                    @endif
                    <tr><td class="meta-label">Telepon</td><td>: {{ $purchaseOrder->supplier?->phone ?? '-' }}</td></tr>
                    @if($purchaseOrder->supplier?->address || $purchaseOrder->supplier?->city)
                        <tr><td class="meta-label">Alamat</td><td>: {{ trim(($purchaseOrder->supplier?->address ?? '') . ($purchaseOrder->supplier?->city ? ', ' . $purchaseOrder->supplier->city : ''), ', ') }}</td></tr>
                    @endif
                    <tr><td class="meta-label">Tempo Bayar</td><td>: {{ ($purchaseOrder->supplier?->payment_term_days ?? 0) > 0 ? $purchaseOrder->supplier->payment_term_days . ' Hari' : 'COD / Tunai' }}</td></tr>
                </table>
            </td>
            <td class="info-box">
                <div class="info-box-title">Informasi Pesanan</div>
                <table class="meta-row">
                    <tr><td class="meta-label">Tanggal Pesan</td><td>: {{ $purchaseOrder->order_date?->format('d M Y') ?? '-' }}</td></tr>
                    <tr><td class="meta-label">Estimasi Datang</td><td>: {{ $purchaseOrder->expected_date?->format('d M Y') ?? '-' }}</td></tr>
                    <tr><td class="meta-label">Jatuh Tempo</td><td>: {{ $purchaseOrder->due_date?->format('d M Y') ?? '-' }}</td></tr>
                    <tr><td class="meta-label">Dibuat Oleh</td><td>: {{ $purchaseOrder->user?->name ?? 'Sistem' }}</td></tr>
                    @if($purchaseOrder->approvedBy)
                        <tr><td class="meta-label">Disetujui Oleh</td><td>: {{ $purchaseOrder->approvedBy->name }} ({{ $purchaseOrder->approved_at?->format('d M Y H:i') }})</td></tr>
                    @endif
                </table>
            </td>
        </tr>
    </table>

    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 5%;" class="text-center">No</th>
                <th style="width: 34%;" class="text-left">Produk & Satuan</th>
                <th style="width: 14%;" class="text-center">Qty Pesan</th>
                <th style="width: 15%;" class="text-right">Harga Satuan</th>
                <th style="width: 14%;" class="text-right">Diskon Item</th>
                <th style="width: 18%;" class="text-right">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            @foreach($purchaseOrder->items as $index => $item)
                <tr>
                    <td class="text-center">{{ $index + 1 }}</td>
                    <td>
                        <div class="product-name">{{ $item->product?->name ?? 'Produk Dihapus' }}</div>
                        <div class="product-meta">
                            Barcode: {{ $item->product?->barcode ?? '-' }}
                            &bull; Satuan: {{ $item->unit_name }} (1 {{ $item->unit_name }} = {{ $item->conversion_factor }} {{ $item->product?->base_unit ?: 'pcs' }})
                        </div>
                    </td>
                    <td class="text-center">
                        {{ number_format((int) $item->quantity_ordered, 0, ',', '.') }} {{ $item->unit_name }}
                        @if((int) $item->free_qty_ordered > 0)
                            <div class="product-meta">+{{ $item->free_qty_ordered }} bonus</div>
                        @endif
                    </td>
                    <td class="text-right">{{ $formatRupiah($item->unit_cost) }}</td>
                    <td class="text-right">{{ (float) $item->discount_amount > 0 ? '- ' . $formatRupiah($item->discount_amount) : '-' }}</td>
                    <td class="text-right font-bold">{{ $formatRupiah($item->subtotal) }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="summary-layout">
        <tr>
            <td class="notes-col">
                <div class="notes-box">
                    <div class="info-box-title">Catatan Pesanan</div>
                    <div style="white-space: pre-line; font-size: 10px;">{{ $purchaseOrder->notes ?: 'Tidak ada catatan tambahan.' }}</div>
                </div>
            </td>
            <td class="totals-col">
                <table class="totals-table">
                    <tr><td class="text-muted">Subtotal Item</td><td class="text-right font-bold">{{ $formatRupiah($purchaseOrder->subtotal) }}</td></tr>
                    <tr><td class="text-muted">{{ $discountLabel }}</td><td class="text-right">- {{ $formatRupiah($purchaseOrder->discount_amount) }}</td></tr>
                    <tr><td class="text-muted">{{ $taxLabel }}</td><td class="text-right">+ {{ $formatRupiah($purchaseOrder->tax_amount) }}</td></tr>
                    <tr class="grand-total"><td>Grand Total</td><td class="text-right">{{ $formatRupiah($purchaseOrder->total_amount) }}</td></tr>
                </table>
            </td>
        </tr>
    </table>

    <table class="signature-table">
        <tr>
            <td>
                <div class="text-muted">Dibuat Oleh,</div>
                <div class="signature-space"></div>
                <div class="signature-line">{{ $purchaseOrder->user?->name ?? 'Pemesan' }}</div>
            </td>
            <td>
                <div class="text-muted">Disetujui Oleh,</div>
                <div class="signature-space"></div>
                <div class="signature-line">{{ $purchaseOrder->approvedBy?->name ?? 'Admin Toko' }}</div>
            </td>
            <td>
                <div class="text-muted">Pihak Supplier,</div>
                <div class="signature-space"></div>
                <div class="signature-line">{{ $purchaseOrder->supplier?->contact_person ?: ($purchaseOrder->supplier?->name ?? 'Supplier') }}</div>
            </td>
        </tr>
    </table>

    <div class="footer">Dicetak pada {{ now()->format('d M Y H:i') }} &bull; {{ config('app.name', 'POS Minimarket') }}</div>
</body>
</html>
