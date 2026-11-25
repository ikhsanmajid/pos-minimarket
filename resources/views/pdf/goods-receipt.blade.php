<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>LPB {{ $receipt->receipt_number }}</title>
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
        .doc-title { font-size: 14px; font-weight: bold; color: #047857; letter-spacing: 0.4px; margin: 0; }
        .doc-number { font-size: 13px; font-weight: bold; color: #111827; margin: 3px 0 0 0; }
        .info-table { width: 100%; margin-bottom: 14px; border-collapse: collapse; }
        .info-box { vertical-align: top; width: 50%; border: 1px solid #e5e7eb; background-color: #f9fafb; padding: 9px 11px; }
        .info-box-title { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 6px; }
        .meta-row { width: 100%; border-collapse: collapse; }
        .meta-row td { padding: 1.5px 0; vertical-align: top; }
        .meta-label { width: 115px; color: #6b7280; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .items-table thead th { background-color: #065f46; color: #ffffff; font-size: 9.5px; font-weight: bold; padding: 6px 7px; border: 1px solid #065f46; }
        .items-table tbody td { padding: 6px 7px; border: 1px solid #e5e7eb; vertical-align: top; }
        .items-table tbody tr:nth-child(even) { background-color: #f9fafb; }
        .notes-box { border: 1px solid #e5e7eb; background-color: #f9fafb; padding: 9px 11px; margin-bottom: 20px; }
        .signature-table { width: 100%; border-collapse: collapse; margin-top: 18px; }
        .signature-table td { width: 50%; text-align: center; vertical-align: top; padding: 0 24px; }
        .signature-space { height: 50px; }
        .signature-line { border-top: 1px solid #9ca3af; padding-top: 4px; font-weight: bold; }
        .footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 6px; font-size: 8.5px; color: #9ca3af; text-align: right; }
    </style>
</head>
<body>
    <table class="header-table">
        <tr>
            <td style="width: 55%; vertical-align: top;">
                <p class="company-name">{{ config('app.name', 'POS Minimarket') }}</p>
                <div class="text-muted" style="font-size: 9.5px;">Laporan Penerimaan Barang (LPB)</div>
            </td>
            <td style="width: 45%; vertical-align: top;" class="text-right">
                <p class="doc-title">BUKTI PENERIMAAN BARANG</p>
                <p class="doc-number">{{ $receipt->receipt_number }}</p>
            </td>
        </tr>
    </table>

    <table class="info-table">
        <tr>
            <td class="info-box" style="border-right: none;">
                <div class="info-box-title">Dokumen Referensi</div>
                <table class="meta-row">
                    <tr><td class="meta-label">No. PO</td><td class="font-bold">: {{ $purchaseOrder->po_number }}</td></tr>
                    <tr><td class="meta-label">No. Surat Jalan</td><td>: {{ $receipt->supplier_delivery_note ?: '-' }}</td></tr>
                    <tr><td class="meta-label">Tanggal Terima</td><td>: {{ $receipt->received_date?->format('d M Y') ?? '-' }}</td></tr>
                    <tr><td class="meta-label">Diterima Oleh</td><td>: {{ $receipt->receivedBy?->name ?? 'Sistem' }}</td></tr>
                </table>
            </td>
            <td class="info-box">
                <div class="info-box-title">Informasi Supplier</div>
                <table class="meta-row">
                    <tr><td class="meta-label">Supplier</td><td class="font-bold">: {{ $purchaseOrder->supplier?->name ?? '-' }}</td></tr>
                    <tr><td class="meta-label">Kode Supplier</td><td>: {{ $purchaseOrder->supplier?->code ?? '-' }}</td></tr>
                    <tr><td class="meta-label">Telepon</td><td>: {{ $purchaseOrder->supplier?->phone ?? '-' }}</td></tr>
                </table>
            </td>
        </tr>
    </table>

    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 5%;" class="text-center">No</th>
                <th style="width: 31%;" class="text-left">Produk</th>
                <th style="width: 15%;" class="text-center">Qty Diterima</th>
                <th style="width: 11%;" class="text-center">Bonus</th>
                <th style="width: 16%;" class="text-center">Masuk Stok Dasar</th>
                <th style="width: 22%;" class="text-left">Batch & Expired</th>
            </tr>
        </thead>
        <tbody>
            @foreach($receipt->items as $index => $item)
                <tr>
                    <td class="text-center">{{ $index + 1 }}</td>
                    <td>
                        <div class="font-bold">{{ $item->product?->name ?? 'Produk Dihapus' }}</div>
                        <div class="text-muted" style="font-size: 9px;">1 {{ $item->unit_name }} = {{ $item->conversion_factor }} {{ $item->product?->base_unit ?: 'pcs' }}</div>
                    </td>
                    <td class="text-center font-bold">{{ number_format((int) $item->qty_received, 0, ',', '.') }} {{ $item->unit_name }}</td>
                    <td class="text-center">{{ (int) $item->free_qty_received > 0 ? '+' . $item->free_qty_received . ' ' . $item->unit_name : '-' }}</td>
                    <td class="text-center font-bold">{{ number_format((int) $item->base_qty_received, 0, ',', '.') }} {{ $item->product?->base_unit ?: 'pcs' }}</td>
                    <td>
                        <div>Batch: {{ $item->batch_number ?: '-' }}</div>
                        <div>Exp: {{ $item->expired_date?->format('d M Y') ?? '-' }}</div>
                    </td>
                </tr>
            @endforeach
        </tbody>
    </table>

    @if($receipt->notes)
        <div class="notes-box">
            <div class="info-box-title">Catatan Penerimaan</div>
            <div style="white-space: pre-line;">{{ $receipt->notes }}</div>
        </div>
    @endif

    <table class="signature-table">
        <tr>
            <td>
                <div class="text-muted">Diterima & Diperiksa Oleh,</div>
                <div class="signature-space"></div>
                <div class="signature-line">{{ $receipt->receivedBy?->name ?? 'Petugas Gudang' }}</div>
            </td>
            <td>
                <div class="text-muted">Pengirim / Kurir Supplier,</div>
                <div class="signature-space"></div>
                <div class="signature-line">{{ $purchaseOrder->supplier?->name ?? 'Supplier' }}</div>
            </td>
        </tr>
    </table>

    <div class="footer">Dicetak pada {{ now()->format('d M Y H:i') }} &bull; {{ config('app.name', 'POS Minimarket') }}</div>
</body>
</html>
