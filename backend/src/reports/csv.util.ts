function escapeCsvCell(value: string | number | undefined): string {
  const text = value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  rows: Record<string, string | number | undefined>[],
  columns: string[],
): string {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((col) => escapeCsvCell(row[col])).join(','));
  }
  return lines.join('\n');
}

// Inverse of toCsv/escapeCsvCell: a small RFC4180-ish parser (quoted fields,
// embedded commas/newlines/escaped quotes) for parsing a bulk-upload CSV back
// into rows keyed by the header line. Good enough for a controlled internal
// format uploaded by the cooperative -- not a general-purpose CSV library.
export function fromCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const text = content.replace(/\r\n/g, '\n');

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (nonEmptyRows.length === 0) return [];

  const [header, ...dataRows] = nonEmptyRows;
  const columns = header.map((h) => h.trim());
  return dataRows.map((r) =>
    Object.fromEntries(columns.map((col, i) => [col, (r[i] ?? '').trim()])),
  );
}
