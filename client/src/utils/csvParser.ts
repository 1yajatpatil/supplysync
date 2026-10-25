/**
 * Simple, robust CSV text parser for user uploaded files
 */

export function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse header
  const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    if (values.length === 0 || values.every(v => v.trim() === '')) continue;
    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx] ? values[idx].trim() : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(s => s.replace(/^["']|["']$/g, '').trim());
}
