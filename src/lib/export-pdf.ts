import { format } from 'date-fns';

type PdfTableSection = {
  kind: 'table';
  title: string;
  headers: string[];
  rows: string[][];
};

type PdfKeyValueSection = {
  kind: 'key-value';
  title: string;
  entries: { label: string; value: string }[];
};

export type PdfSection = PdfTableSection | PdfKeyValueSection;

export type ExportPdfOptions = {
  title: string;
  subtitle?: string;
  filename: string;
  sections: PdfSection[];
  generatedAt?: Date;
};

const PAGE_MARGIN = 14;
const SECTION_GAP = 10;
const HEADER_COLOR: [number, number, number] = [41, 41, 41];
const STRIPE_COLOR: [number, number, number] = [245, 245, 245];

export async function exportPdf(options: ExportPdfOptions): Promise<void> {
  const [{ jsPDF, }, { default: autoTable, }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);

  const doc = new jsPDF({
 orientation: 'portrait',
unit: 'mm',
format: 'a4', 
});
  const pageWidth = doc.internal.pageSize.getWidth();
  const timestamp = format(
    options.generatedAt ?? new Date(),
    'MMM d, yyyy h:mm a'
  );

  let cursorY = PAGE_MARGIN;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title, PAGE_MARGIN, cursorY + 6);
  cursorY += 10;

  if (options.subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(options.subtitle, PAGE_MARGIN, cursorY + 4);
    cursorY += 6;
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140);
  doc.text(`Generated ${timestamp}`, PAGE_MARGIN, cursorY + 4);
  cursorY += 8;

  doc.setDrawColor(200);
  doc.line(PAGE_MARGIN, cursorY, pageWidth - PAGE_MARGIN, cursorY);
  cursorY += SECTION_GAP;

  doc.setTextColor(0);

  for (const section of options.sections) {
    if (cursorY > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      cursorY = PAGE_MARGIN;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, PAGE_MARGIN, cursorY + 4);
    cursorY += 8;

    const body =
      section.kind === 'key-value'
        ? section.entries.map((entry) => [entry.label, entry.value])
        : section.rows;

    const head =
      section.kind === 'key-value'
        ? [['Metric', 'Value']]
        : [section.headers];

    autoTable(doc, {
      startY: cursorY,
      head,
      body,
      margin: {
 left: PAGE_MARGIN,
right: PAGE_MARGIN, 
},
      headStyles: {
        fillColor: HEADER_COLOR,
        textColor: 255,
        fontSize: 8,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: 40,
      },
      alternateRowStyles: { fillColor: STRIPE_COLOR, },
      styles: {
        cellPadding: 2.5,
        lineWidth: 0.1,
        lineColor: [220, 220, 220],
      },
    });

    const finalY = (
      doc as unknown as { lastAutoTable: { finalY: number } }
    ).lastAutoTable.finalY;
    cursorY = finalY + SECTION_GAP;
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - PAGE_MARGIN,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'right', }
    );
  }

  doc.save(options.filename);
}
