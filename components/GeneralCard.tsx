"use client";

import { STRATEGIST_INTELLECT_MIN, TRAITS, WARRIOR_COMBAT_MIN } from "@/lib/constants";
import { GENERAL_BY_ID } from "@/lib/roster";
import type { CardInstance, Faction } from "@/lib/types";
import { useState } from "react";

// 국가별 색상 (아트 없을 때 배경 + 테두리·배지)
const FACTION_STYLE: Record<Faction, { hanja: string; from: string; to: string; border: string; badge: string }> = {
  위: { hanja: "魏", from: "from-purple-950", to: "to-purple-800", border: "border-purple-500", badge: "bg-purple-700" },
  촉: { hanja: "蜀", from: "from-green-950", to: "to-green-800", border: "border-green-500", badge: "bg-green-700" },
  오: { hanja: "吳", from: "from-amber-950", to: "to-amber-700", border: "border-amber-500", badge: "bg-amber-600" },
  군웅: { hanja: "群", from: "from-red-950", to: "to-red-800", border: "border-red-500", badge: "bg-red-700" },
};

const STAT_LABELS: { key: "combat" | "politics" | "intellect" | "leadership"; label: string }[] = [
  { key: "combat", label: "전투" },
  { key: "politics", label: "정치" },
  { key: "intellect", label: "지략" },
  { key: "leadership", label: "통솔" },
];

export function roleTag(card: CardInstance): string {
  const w = card.stats.combat >= WARRIOR_COMBAT_MIN;
  const s = card.stats.intellect >= STRATEGIST_INTELLECT_MIN;
  if (w && s) return "장수·모사";
  if (w) return "장수";
  if (s) return "모사";
  return "문관";
}

export default function GeneralCard({
  card,
  selected = false,
  dimmed = false,
  small = false,
  onClick,
}: {
  card: CardInstance;
  selected?: boolean;
  dimmed?: boolean;
  small?: boolean;
  onClick?: () => void;
}) {
  const gen = GENERAL_BY_ID[card.generalId];
  const fs = FACTION_STYLE[gen.faction];
  // 아트 탐색: webp → png → 플레이스홀더
  const [srcIdx, setSrcIdx] = useState(0);
  const sources = [`/art/${gen.id}.webp`, `/art/${gen.id}.png`];
  const hasArt = srcIdx < sources.length;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border-2 bg-gradient-to-b ${fs.from} ${fs.to} ${
        selected ? "border-yellow-300 -translate-y-3 shadow-lg shadow-yellow-500/30" : fs.border
      } ${dimmed ? "opacity-40" : ""} ${onClick ? "cursor-pointer hover:-translate-y-2" : ""} ${
        small ? "w-28 h-40" : "w-40 h-[15rem]"
      } transition-transform duration-150 select-none shrink-0`}
    >
      {/* 배경 워터마크 (아트 없을 때) */}
      {!hasArt && (
        <span
          className="absolute inset-0 flex items-center justify-center text-white/15 font-serif"
          style={{ fontSize: small ? 56 : 84 }}
        >
          {fs.hanja}
        </span>
      )}

      {/* 전면 아트: 카드 전체 채움 */}
      {hasArt && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sources[srcIdx]}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setSrcIdx(srcIdx + 1)}
        />
      )}

      {/* 상단 오버레이: 국가·등급 */}
      <div className="absolute top-0 inset-x-0 flex items-start justify-between p-1.5 bg-gradient-to-b from-black/70 via-black/25 to-transparent pb-4">
        <span className={`${fs.badge} text-white rounded px-1 text-xs font-bold shadow`}>{fs.hanja}</span>
        <span className="text-yellow-300 text-xs tracking-tighter drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {"★".repeat(card.grade)}
        </span>
      </div>

      {/* 하단 오버레이: 이름·문구·역할·특성·수치 */}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent pt-6 px-1.5 pb-1.5">
        <p
          className={`text-center text-white font-bold leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,1)] ${
            small ? "text-sm" : "text-xl"
          }`}
        >
          {gen.name}
        </p>
        {!small && (
          <p className="text-center text-white/75 text-[10px] leading-tight truncate">{gen.title}</p>
        )}
        <p className="text-center text-white/60 text-[9px] mb-1 leading-tight">
          {roleTag(card)}
          {card.traits?.map((id) => {
            const t = TRAITS.find((x) => x.id === id);
            return t ? (
              <span key={id} className="ml-1 text-amber-300" title={t.desc}>
                [{t.name}]
              </span>
            ) : null;
          })}
        </p>
        <div className="grid grid-cols-4 gap-0.5 rounded bg-black/55 backdrop-blur-[2px] p-1">
          {STAT_LABELS.map(({ key, label }) => (
            <div key={key} className="flex flex-col items-center">
              <span className="text-white/55 text-[8px]">{label}</span>
              <span className={`text-white font-bold ${small ? "text-[10px]" : "text-sm"}`}>{card.stats[key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
