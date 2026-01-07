"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SlotReveal from "@/components/SlotReveal";
import Importer from "@/components/Importer";
import { shuffleCrypto } from "@/lib/rng";
import { downloadCSV, downloadXLSX } from "@/lib/io";

type Mode = "names" | "range";
type RunMode = "one" | "all";

type Grouped = {
  name: string;
  members: string[];
};

function clampInt(v: number, min: number, max: number) {
  if (Number.isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export default function Page() {
  const [mode, setMode] = useState<Mode>("names");

  const [runMode, setRunMode] = useState<RunMode>("one");
  const [lastPick, setLastPick] = useState<string | null>(null);

  // mode names
  const [inputs, setInputs] = useState<string[]>([""]);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // mode range
  const [rangeFrom, setRangeFrom] = useState<number>(1);
  const [rangeTo, setRangeTo] = useState<number>(30);

  // groups
  const [groupCount, setGroupCount] = useState<number>(5);

  // generation flow
  const [pool, setPool] = useState<string[]>([]);  
  const [isGenerating, setIsGenerating] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [groups, setGroups] = useState<Grouped[]>([]);
  const [done, setDone] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const participants = useMemo(() => {
    if (mode === "range") {
      const a = Math.min(rangeFrom, rangeTo);
      const b = Math.max(rangeFrom, rangeTo);
      const out: string[] = [];
      for (let i = a; i <= b; i++) out.push(String(i));
      return out;
    }
    return Array.from(
      new Set(inputs.map(s => s.trim()).filter(Boolean))
    );
  }, [mode, inputs, rangeFrom, rangeTo]);

  // init group containers whenever count changes
  useEffect(() => {
    const n = clampInt(groupCount, 1, 99);
    setGroups(Array.from({ length: n }, (_, i) => ({
      name: `Kelompok ${i + 1}`,
      members: [],
    })));
  }, [groupCount]);

  function addRow(atIndex?: number) {
    setInputs(prev => {
      const next = [...prev];
      if (typeof atIndex === "number") next.splice(atIndex + 1, 0, "");
      else next.push("");
      return next;
    });
    // fokus setelah render
    setTimeout(() => {
      const idx = typeof atIndex === "number" ? atIndex + 1 : inputs.length;
      inputRefs.current[idx]?.focus();
    }, 0);
  }

  function removeRow(index: number) {
    setInputs(prev => {
      if (prev.length <= 1) return [""];
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }

  function setRow(index: number, value: string) {
    setInputs(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function resetResult() {
    setDone(false);
    setCurrent(null);
    setQueue([]);
    setPool([]);
    setLastPick(null);
    setShowModal(false);
    setGroups(g => g.map(x => ({ ...x, members: [] })));
  }

  function initPoolIfNeeded(): string[] | null {
    const list = participants;
    if (list.length === 0) return null;

    if (pool.length === 0 && groups.every(g => g.members.length === 0) && !done) {
      const shuffled = shuffleCrypto(list);
      setPool(shuffled);
      return shuffled;
    }

    return pool;
  }

  function startNext(mode: RunMode) {
    if (isGenerating) return;

    const p = initPoolIfNeeded();
    if (!p || p.length === 0) return;

    setRunMode(mode);
    setDone(false);
    setShowModal(false);
    setIsGenerating(true);
    setCurrent(p[0]); // trigger SlotReveal
  }

  function generateOne() {
    startNext("one");
  }

  function generateAll() {
    startNext("all");
  }


  function startGenerate() {
    const nGroups = clampInt(groupCount, 1, 99);
    const list = participants;

    resetResult();

    if (list.length === 0) return;

    // shuffle dulu biar RNG
    const shuffled = shuffleCrypto(list);

    setIsGenerating(true);
    setDone(false);

    // siapkan queue yang akan dianimasikan satu per satu
    setQueue(shuffled);
    setCurrent(shuffled[0] ?? null);

    // pastikan groups sesuai count (kalau user baru ubah)
    setGroups(Array.from({ length: nGroups }, (_, i) => ({
      name: `Kelompok ${i + 1}`,
      members: [],
    })));
  }

  function assignNext(revealed: string) {
    setLastPick(revealed);

    // 1) assign ke group (balance)
    setGroups(prev => {
      let bestIdx = 0;
      for (let i = 1; i < prev.length; i++) {
        if (prev[i].members.length < prev[bestIdx].members.length) bestIdx = i;
      }
      return prev.map((g, i) =>
        i === bestIdx ? { ...g, members: [...g.members, revealed] } : g
      );
    });

    // 2) pop dari pool
    setPool(prev => {
      const rest = prev.slice(1);

      if (rest.length === 0) {
        setCurrent(null);
        setIsGenerating(false);
        setDone(true);
        return rest;
      }

      // 3) lanjut atau stop tergantung mode
      if (runMode === "all") {
        setCurrent(rest[0]);      // auto lanjut
        // isGenerating tetap true
      } else {
        setCurrent(null);         // stop setelah 1
        setIsGenerating(false);
        setShowModal(true);
      }

      return rest;
    });
  }

  function exportRows() {
    const rows: Array<{ group: string; member: string }> = [];
    for (const g of groups) {
      for (const m of g.members) rows.push({ group: g.name, member: m });
    }
    return rows;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            RNG Group Classifier
          </h1>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left: Controls */}
          <section className="lg:col-span-1 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-white/70">Mode Input</div>
                  <div className="mt-1 flex gap-2">
                    <button
                      className={`rounded-xl px-3 py-2 text-sm ${
                        mode === "names" ? "bg-white text-black" : "bg-white/10 hover:bg-white/15"
                      }`}
                      onClick={() => setMode("names")}
                      disabled={isGenerating}
                    >
                      Nama
                    </button>
                    <button
                      className={`rounded-xl px-3 py-2 text-sm ${
                        mode === "range" ? "bg-white text-black" : "bg-white/10 hover:bg-white/15"
                      }`}
                      onClick={() => setMode("range")}
                      disabled={isGenerating}
                    >
                      Angka (Range)
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-white/70">Jumlah Kelompok</div>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={groupCount}
                    disabled={isGenerating}
                    onChange={(e) => setGroupCount(clampInt(parseInt(e.target.value || "1", 10), 1, 99))}
                    className="mt-1 w-24 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
                  />
                </div>
              </div>
            </div>

            {mode === "range" ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm text-white/70">Range Angka</div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    value={rangeFrom}
                    disabled={isGenerating}
                    onChange={(e) => setRangeFrom(parseInt(e.target.value || "1", 10))}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
                    placeholder="Mulai"
                  />
                  <input
                    type="number"
                    value={rangeTo}
                    disabled={isGenerating}
                    onChange={(e) => setRangeTo(parseInt(e.target.value || "1", 10))}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
                    placeholder="Sampai"
                  />
                </div>
                <div className="mt-2 text-xs text-white/60">
                  Total peserta: <span className="text-white">{participants.length}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm text-white/70">Daftar Nama</div>
                  <div className="text-xs text-white/60">
                    Total: <span className="text-white">{participants.length}</span>
                  </div>
                </div>

                <div className="name-list max-h-[380px] space-y-2 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-2 pr-3">
                  {inputs.map((v, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1"
                    >
                      <input
                        ref={(el) => { inputRefs.current[idx] = el; }}
                        value={v}
                        disabled={isGenerating}
                        onChange={(e) => setRow(idx, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addRow(idx);
                          }
                          if ((e.key === "Backspace" || e.key === "Delete") && v.trim() === "" && inputs.length > 1) {
                            // hapus row kosong cepat
                            e.preventDefault();
                            removeRow(idx);
                            setTimeout(() => inputRefs.current[Math.max(0, idx - 1)]?.focus(), 0);
                          }
                        }}
                        placeholder={`Nama ${idx + 1}`}
                        className="w-full bg-transparent px-2 py-2 text-sm outline-none placeholder:text-white/30 focus:text-white"
                      />
                      <button
                        disabled={isGenerating}
                        onClick={() => removeRow(idx)}
                        className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-sm hover:bg-white/20 disabled:opacity-50"
                        title="Hapus"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    disabled={isGenerating}
                    onClick={() => addRow()}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                  >
                    + Tambah
                  </button>
                  <button
                    disabled={isGenerating}
                    onClick={() => setInputs([""])}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <Importer
              onItems={(items) => {
                // masuk ke mode names
                setMode("names");
                setInputs(items.length ? [...items, ""] : [""]);
              }}
            />

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={generateOne}
                  disabled={isGenerating || participants.length === 0 || groupCount < 1 || (pool.length === 0 && done)}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
                >
                  Generate 1x
                </button>

                <button
                  onClick={generateAll}
                  disabled={isGenerating || participants.length === 0 || groupCount < 1 || (pool.length === 0 && done)}
                  className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
                >
                  Generate All
                </button>
              </div>

              {done && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => downloadCSV("groups.csv", exportRows())}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => downloadXLSX("groups.xlsx", exportRows())}
                    className="rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                  >
                    Export Excel
                  </button>
                  <button
                    onClick={resetResult}
                    className="ml-auto rounded-xl bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                  >
                    Reset Result
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Right: Animation + Groups */}
          <section className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6">
              <div className="text-sm text-white/70">Generated RNG</div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-44">
                {current ? (
                  <SlotReveal
                    target={current}
                    className="text-center text-6xl md:text-6xl"
                    onDone={() => assignNext(current)}
                  />
                ) : (
                  <div className="text-center text-white/50">
                    {done ? "Selesai ✅" : "Tekan Generate untuk mulai"}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between text-xs text-white/60">
                  <div>Sisa peserta: <span className="text-white">{pool.length}</span></div>
                  <div>Total peserta: <span className="text-white">{participants.length}</span></div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {groups.map((g, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-xs text-white/60">{g.members.length} orang</div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {g.members.length === 0 ? (
                      <div className="text-sm text-white/40">—</div>
                    ) : (
                      g.members.map((m, i) => (
                        <div
                          key={i}
                          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                        >
                          {m}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="mt-10 text-xs text-white/40">
          Tips: di mode Nama, tekan <span className="text-white">Enter</span> untuk tambah baris. Backspace pada baris kosong untuk hapus cepat.
        </footer>
      </div>

      {showModal && lastPick && runMode === "one" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-zinc-900 p-10 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex w-full flex-col items-center text-center">
                <div className="text-xs uppercase tracking-widest text-white/50">Hasil Generate</div>
                <div className="mt-6 inline-flex items-center justify-center rounded-[28px] border border-white/15 bg-white/10 px-12 py-8 text-6xl font-semibold text-white shadow-[0_0_40px_rgba(255,255,255,0.18)] md:text-7xl">
                  {lastPick}
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>            
          </div>
        </div>
      )}
    </main>
  );
}
