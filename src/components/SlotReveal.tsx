"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

type SlotRevealProps = {
  target: string;
  onDone?: () => void;
  className?: string;
  speedMs?: number;        
  settleDelayMs?: number;  
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function randChar() {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
}

export default function SlotReveal({
  target,
  onDone,
  className,
  speedMs = 28,
  settleDelayMs = 450,
}: SlotRevealProps) {
  const upper = useMemo(() => target.toUpperCase(), [target]);
  const [shown, setShown] = useState<string>(() => "");
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    setShown("");

    const len = upper.length;
    let tick = 0;
    let locked = 0;

    const lockEvery = 4;

    const id = window.setInterval(() => {
      tick++;

      if (tick % lockEvery === 0 && locked < len) locked++;

      let s = "";
      for (let i = 0; i < len; i++) {
        const ch = upper[i] ?? "";
        if (ch === " ") {
          s += " ";
          continue;
        }
        if (i < locked) s += ch;
        else s += randChar();
      }
      setShown(s);

      if (locked >= len) {
        window.clearInterval(id);
        window.setTimeout(() => {
          if (!doneRef.current) {
            doneRef.current = true;
            setShown(upper);
            onDone?.();
          }
        }, settleDelayMs);
      }
    }, speedMs);

    return () => window.clearInterval(id);
  }, [upper, onDone, speedMs, settleDelayMs]);

  return (
    <div className={className}>
      <motion.div
        initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.25 }}
        className="font-mono tracking-widest"
      >
        {shown.padEnd(upper.length, " ")}
      </motion.div>
    </div>
  );
}
