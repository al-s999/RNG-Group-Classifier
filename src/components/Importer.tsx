"use client";

import { useRef, useState } from "react";
import { importCSV, importXLSX } from "@/lib/io";

type Props = {
  onItems: (items: string[]) => void;
};

export default function Importer({ onItems }: Props) {
  const csvRef = useRef<HTMLInputElement | null>(null);
  const xlsxRef = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState<string>("");

  async function handle(file: File, kind: "csv" | "xlsx") {
    setMsg("Mengimpor...");
    try {
      const res = kind === "csv" ? await importCSV(file) : await importXLSX(file);
      const unique = Array.from(new Set(res.items.map(s => s.trim()).filter(Boolean)));
      onItems(unique);
      setMsg(
        `Berhasil impor ${unique.length} item` +
          (res.warnings.length ? ` (warning: ${res.warnings[0]})` : "")
      );
    } catch (e: any) {
      setMsg(`Gagal impor: ${e?.message ?? "Unknown error"}`);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          onClick={() => csvRef.current?.click()}
        >
          Import CSV
        </button>
        <button
          className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          onClick={() => xlsxRef.current?.click()}
        >
          Import Excel
        </button>
        <span className="text-xs text-white/60">{msg}</span>
      </div>

      <input
        ref={csvRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f, "csv");
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={xlsxRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f, "xlsx");
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
