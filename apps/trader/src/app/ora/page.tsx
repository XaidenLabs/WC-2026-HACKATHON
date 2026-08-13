"use client";

import { Sparkles } from "lucide-react";
import StrategyStudio from "@/components/StrategyStudio";
import OraAutopilot from "@/components/OraAutopilot";
import TraderShell from "@/components/TraderShell";

export default function OraCommandCenter() {
  return (
    <TraderShell title="Ask ORA" subtitle="Scan today’s games or describe your own football rule.">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#25170e] text-[#ff650f]">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-[-0.04em] text-[#efefeb]">Your football assistant</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#85877f]">
              Ask ORA to check today’s games or explain the kind of opportunity you want. You will see the football reasoning, not the machinery behind it.
            </p>
          </div>
        </div>

        <div className="mb-5">
          <OraAutopilot />
        </div>

        <StrategyStudio />
      </div>
    </TraderShell>
  );
}
