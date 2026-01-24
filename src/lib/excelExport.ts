import * as XLSX from 'xlsx';

export interface ExportMetadata {
  exported_at: string;
  exported_by_id: string | null;
  exported_by_email: string | null;
  source_page: string;
  applied_filters: Record<string, string>;
  total_rows: number;
  note?: string;
}

interface ExportOptions {
  data: Record<string, unknown>[];
  filename: string;
  sheetName?: string;
  metadata?: ExportMetadata;
  columnOrder?: string[];
  columnLabels?: Record<string, string>;
}

// Additional sheet configuration for multi-sheet export
export interface AdditionalSheet {
  sheetName: string;
  data: Record<string, unknown>[];
  columnOrder?: string[];
  columnLabels?: Record<string, string>;
}

interface MultiSheetExportOptions extends ExportOptions {
  additionalSheets?: AdditionalSheet[];
}

/**
 * Generates a formatted filename with timestamp
 * Format: <prefix>_<YYYY-MM-DD>_<HHmm>.xlsx
 */
export function generateExportFilename(prefix: string): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 5).replace(':', ''); // HHmm
  return `${prefix}_${date}_${time}.xlsx`;
}

/**
 * Creates a worksheet from data with optional column ordering and labels
 */
function createWorksheet(
  data: Record<string, unknown>[],
  columnOrder?: string[],
  columnLabels?: Record<string, string>
): XLSX.WorkSheet {
  let exportData = data;
  
  if (columnOrder) {
    exportData = data.map((row) => {
      const orderedRow: Record<string, unknown> = {};
      columnOrder.forEach((col) => {
        const label = columnLabels?.[col] || col;
        orderedRow[label] = row[col];
      });
      return orderedRow;
    });
  } else if (columnLabels) {
    exportData = data.map((row) => {
      const labeledRow: Record<string, unknown> = {};
      Object.keys(row).forEach((key) => {
        const label = columnLabels[key] || key;
        labeledRow[label] = row[key];
      });
      return labeledRow;
    });
  }

  const sheet = XLSX.utils.json_to_sheet(exportData);
  
  // Auto-size columns
  const maxWidths: number[] = [];
  exportData.forEach((row) => {
    Object.values(row).forEach((val, idx) => {
      const len = String(val ?? '').length;
      maxWidths[idx] = Math.max(maxWidths[idx] || 10, len, 10);
    });
  });
  
  if (exportData.length > 0) {
    Object.keys(exportData[0]).forEach((key, idx) => {
      maxWidths[idx] = Math.max(maxWidths[idx] || 10, key.length);
    });
  }
  sheet['!cols'] = maxWidths.map((w) => ({ wch: Math.min(w + 2, 50) }));
  
  return sheet;
}

/**
 * Exports data to an Excel file with optional metadata sheet and additional sheets
 * This is a READ-ONLY operation - no database writes
 */
export function exportToExcel({
  data,
  filename,
  sheetName = 'Data',
  metadata,
  columnOrder,
  columnLabels,
  additionalSheets,
}: MultiSheetExportOptions): void {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Create main data sheet
  const dataSheet = createWorksheet(data, columnOrder, columnLabels);
  XLSX.utils.book_append_sheet(workbook, dataSheet, sheetName);

  // Add additional sheets (master data)
  if (additionalSheets && additionalSheets.length > 0) {
    additionalSheets.forEach((sheet) => {
      if (sheet.data && sheet.data.length > 0) {
        const additionalSheet = createWorksheet(
          sheet.data,
          sheet.columnOrder,
          sheet.columnLabels
        );
        XLSX.utils.book_append_sheet(workbook, additionalSheet, sheet.sheetName);
      }
    });
  }

  // Create metadata sheet if provided
  if (metadata) {
    const metadataRows: { Field: string; Value: string | number }[] = [
      { Field: 'Exported At (ISO)', Value: metadata.exported_at },
      { Field: 'Exported By (User ID)', Value: metadata.exported_by_id || 'N/A' },
      { Field: 'Exported By (Email)', Value: metadata.exported_by_email || 'N/A' },
      { Field: 'Source Page', Value: metadata.source_page },
      { Field: 'Total Rows', Value: metadata.total_rows },
    ];

    // Add note if provided
    if (metadata.note) {
      metadataRows.push({ Field: 'Note', Value: metadata.note });
    }

    metadataRows.push({ Field: '---', Value: '---' });
    metadataRows.push({ Field: 'Applied Filters', Value: '' });

    // Add filter details
    Object.entries(metadata.applied_filters).forEach(([key, value]) => {
      metadataRows.push({ Field: `  ${key}`, Value: value || 'All' });
    });

    const metadataSheet = XLSX.utils.json_to_sheet(metadataRows);
    metadataSheet['!cols'] = [{ wch: 25 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
  }

  // Write and download
  XLSX.writeFile(workbook, filename);
}

/**
 * Format date for display in Excel
 */
export function formatDateForExcel(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
}
