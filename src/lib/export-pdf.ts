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

type PdfImageSection = {
  kind: 'image';
  title: string;
  imageDataUrl: string;
  caption?: string;
  maxHeightMm?: number;
};

export type PdfSection =
  | PdfTableSection
  | PdfKeyValueSection
  | PdfImageSection;

export type ExportPdfOptions = {
  title: string;
  subtitle?: string;
  filename: string;
  sections: PdfSection[];
  generatedAt?: Date;
  orientation?: 'portrait' | 'landscape';
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
orientation: options.orientation ?? 'portrait',
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

    if (section.kind === 'image') {
      const pageHeight = doc.internal.pageSize.getHeight();
      const usableWidth = pageWidth - PAGE_MARGIN * 2;
      const imageProps = doc.getImageProperties(section.imageDataUrl);
      const naturalRatio = imageProps.height / imageProps.width;
      const reservedCaptionHeight = section.caption ? 10 : 0;
      const maxHeight = Math.min(
        section.maxHeightMm ?? pageHeight - cursorY - PAGE_MARGIN - reservedCaptionHeight,
        pageHeight - cursorY - PAGE_MARGIN - reservedCaptionHeight
      );

      let imageWidth = usableWidth;
      let imageHeight = usableWidth * naturalRatio;

      if (imageHeight > maxHeight) {
        imageHeight = maxHeight;
        imageWidth = imageHeight / naturalRatio;
      }

      if (cursorY + imageHeight + reservedCaptionHeight > pageHeight - PAGE_MARGIN) {
        doc.addPage();
        cursorY = PAGE_MARGIN;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, PAGE_MARGIN, cursorY + 4);
        cursorY += 8;
      }

      doc.addImage(
        section.imageDataUrl,
        'PNG',
        PAGE_MARGIN,
        cursorY,
        imageWidth,
        imageHeight
      );
      cursorY += imageHeight + 4;

      if (section.caption) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(90);
        const captionLines = doc.splitTextToSize(section.caption, usableWidth);
        doc.text(captionLines, PAGE_MARGIN, cursorY + 3);
        cursorY += captionLines.length * 4 + SECTION_GAP - 1;
        doc.setTextColor(0);
      } else {
        cursorY += SECTION_GAP;
      }

      continue;
    }

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
