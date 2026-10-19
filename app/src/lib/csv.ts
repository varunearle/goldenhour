/**
 * One CSV cell. Quotes are doubled, and text a spreadsheet would read as a formula
 * (starting with = + - @, tab or carriage return) gets a leading apostrophe so it stays text.
 */
export function csvCell(value: string | number | boolean): string {
  if (typeof value !== 'string') return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: (string | number | boolean)[][]): string {
  return [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');
}

export function downloadCsv(filename: string, header: string[], rows: (string | number | boolean)[][]) {
  const url = URL.createObjectURL(new Blob([toCsv(header, rows)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
