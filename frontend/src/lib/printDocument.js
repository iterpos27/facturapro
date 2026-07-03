export function printDocument(selector = '.print-document') {
  const source = document.querySelector(selector);
  if (!source) {
    window.print();
    return;
  }

  const clone = source.cloneNode(true);
  clone.querySelectorAll('.btn, .modal-close-btn, .form-actions-buttons, .no-print').forEach((node) => {
    node.remove();
  });

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    window.print();
    return;
  }

  const inheritedStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n');

  printWindow.document.open();
  printWindow.document.write(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>FacturaPro</title>
    ${inheritedStyles}
    <style>
      @page { size: A4; margin: 0; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .print-page {
        width: 210mm;
        min-height: 297mm;
        box-sizing: border-box;
        padding: 11mm 12mm;
        margin: 0 auto;
        background: #ffffff;
      }
      .print-document {
        position: static !important;
        inset: auto !important;
        display: block !important;
        width: 100% !important;
        max-width: none !important;
        min-height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        overflow: visible !important;
        transform: none !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-size: 10px !important;
      }
      .print-document h1,
      .print-document h2,
      .print-document h3 {
        margin-top: 0 !important;
      }
      .print-document table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 9px !important;
      }
      .print-document th,
      .print-document td {
        border: 1px solid #000000 !important;
        padding: 4px !important;
        color: #000000 !important;
      }
      .print-document .btn,
      .print-document .modal-close-btn,
      .print-document .form-actions-buttons,
      .print-document .no-print {
        display: none !important;
      }
      @media print {
        html, body { width: 210mm; min-height: 297mm; }
        .print-page { margin: 0; }
      }
    </style>
  </head>
  <body>
    <main class="print-page">${clone.outerHTML}</main>
  </body>
</html>
  `);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 350);
}
