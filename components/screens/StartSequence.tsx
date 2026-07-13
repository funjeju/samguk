"use client";

import { type MatchState } from "@/lib/match";
import { motion } from "framer-motion";
import { useState } from "react";
import { factionRatio } from "./common";

export default function StartSequence({ match, onDone }: { match: MatchState; onDone: () => void }) {
  const [step, setStep] = useState(0);

  const myFactions = factionRatio([...match.myHand, ...match.myDeck]);

  const steps = [
    {
      label: "역사 발동",
      title: match.scenario.name,
      lines: match.scenario.ruleTexts,
      color: "text-red-400",
    },
    {
      label: "전투 도시 발동",
      title: match.city.name,
      lines: [match.city.ruleText, `${match.city.name} 연고 장수는 홈 보너스 ×1.05`],
      color: "text-blue-400",
    },
    {
      label: "국가 구성 공개",
      title: "양측 구성 비율",
      lines: [
        `나의 덱 — ${myFactions}`,
        `컬렉션 카드 ${match.ownedCount}장 + 용병 ${30 - match.ownedCount}장 출전`,
        "상대 덱 — 총 전투력·구성은 대전 중 점차 공개",
        match.phaseShifts > 0
          ? `⚡ 국면 전환 ${match.phaseShifts}회 — ${match.shiftTurns.join(", ")}턴에 역사·전장 재추첨`
          : "국면 전환 없음 — 이 국면으로 끝까지",
      ],
      color: "text-amber-400",
    },
  ];

  const cur = steps[step];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 p-6">
      <motion.div
        key={step}
        initial={{ opacity: 0, scale: 0.8, rotateX: 60 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md rounded-2xl border border-white/20 bg-stone-900/90 p-8 text-center shadow-2xl"
      >
          <p className={`${cur.color} tracking-[0.4em] text-sm mb-4`}>{cur.label}</p>
          <h2 className="text-4xl font-bold mb-6">{cur.title}</h2>
          <div className="space-y-2">
            {cur.lines.map((l, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.25 }}
                className="text-white/70 text-sm"
              >
                {l}
              </motion.p>
            ))}
          </div>
      </motion.div>
      <button
        onClick={() => (step < steps.length - 1 ? setStep(step + 1) : onDone())}
        className="rounded-lg bg-amber-600 px-10 py-3 text-lg font-bold hover:bg-amber-500 transition-colors"
      >
        {step < steps.length - 1 ? "다음" : "대전 시작"}
      </button>
    </div>
  );
}
