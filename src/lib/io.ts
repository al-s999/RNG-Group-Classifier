import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ImportResult = {
  items: string[];
  warnings: string[];
};

export async function importCSV(file: File): Promise<ImportResult> {
  const text = await file.text();
  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: true,
  });

  const warnings: string[] = [];
  if (parsed.errors?.length) warnings.push(...parsed.errors.map(e => e.message));

  const rows = (parsed.data ?? []) as unknown as any[];
  const items: string[] = [];
  for (const row of rows) {
    if (Array.isArray(row)) {
      for (const cell of row) {
        const v = String(cell ?? "").trim();
        if (v) items.push(v);
      }
    } else {
      const v = String(row ?? "").trim();
      if (v) items.push(v);
    }
  }

  return { items, warnings };
}

export async function importXLSX(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const warnings: string[] = [];
  const items: string[] = [];

  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { items: [], warnings: ["Workbook tidak punya sheet."] };

  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

  for (const row of json) {
    for (const cell of row) {
      const v = String(cell ?? "").trim();
      if (v) items.push(v);
    }
  }

  return { items, warnings };
}

export function downloadCSV(filename: string, rows: Array<Record<string, any>>) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadXLSX(filename: string, rows: Array<Record<string, any>>) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Groups");
  XLSX.writeFile(wb, filename);
}
