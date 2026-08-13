"use client";

import type { MotionValue } from "framer-motion";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const PROOF_WORDS = [
  "Every",
  "pick,",
  "pass,",
  "approval,",
  "and",
  "result",
  "stays",
  "part",
  "of",
  "the",
  "record.",
];

const PROOF_STATES = [
  ["Forecast", "ORA can say what looks likely without calling it a trade."],
  ["Qualified", "A pick appears only when the price clears the value rules."],
  ["Reviewed", "The user can approve, decline, or let saved limits handle it."],
  ["Recorded", "The result is saved in history so ORA builds a public track record."],
] as const;

export function HeroEntrance({ children }: { children: React.ReactNode }) {
  return <div className="landing-rise">{children}</div>;
}

export function ProductPreviewEntrance({ children }: { children: React.ReactNode }) {
  return <div className="landing-rise-delayed">{children}</div>;
}

export function ProofNarrative() {
  const section = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start 72%", "end 42%"],
  });

  return (
    <section ref={section} id="track-record" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="max-w-2xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-[#f4f4ef] sm:text-5xl lg:text-6xl">
            {PROOF_WORDS.map((word, index) => (
              <RevealWord key={`${word}-${index}`} index={index} progress={scrollYProgress} reduce={Boolean(reduce)}>
                {word}{" "}
              </RevealWord>
            ))}
          </p>
          <p className="mt-6 max-w-md text-base leading-7 text-[#8c8e87]">
            ORA should be judged by its record, not by a single good-looking screenshot.
          </p>
        </div>

        <div className="space-y-4">
          {PROOF_STATES.map(([label, copy], index) => (
            <motion.article
              key={label}
              initial={reduce ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ duration: 0.58, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="grid min-h-40 grid-cols-[auto_1fr] gap-6 border border-[#252721] bg-[#11120f] p-6 sm:p-8"
            >
              <span className="font-mono text-sm font-semibold tabular-nums text-[#ff650f]">0{index + 1}</span>
              <div>
                <h3 className="text-2xl font-bold tracking-[-0.025em] text-[#efefeb]">{label}</h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-[#8c8e87]">{copy}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RevealWord({
  children,
  index,
  progress,
  reduce,
}: {
  children: React.ReactNode;
  index: number;
  progress: MotionValue<number>;
  reduce: boolean;
}) {
  const start = index / (PROOF_WORDS.length + 2);
  const opacity = useTransform(progress, [start, Math.min(start + 0.22, 1)], [0.55, 1]);

  return (
    <motion.span style={{ opacity: reduce ? 1 : opacity }} className="mr-[0.24em] inline-block">
      {children}
    </motion.span>
  );
}
