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
