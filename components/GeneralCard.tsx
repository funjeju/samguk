"use client";

import { STRATEGIST_INTELLECT_MIN, WARRIOR_COMBAT_MIN } from "@/lib/constants";
import { GENERAL_BY_ID } from "@/lib/roster";
import type { CardInstance, Faction } from "@/lib/types";

// 국가별 색상 (샘플 아트 톤 참고: 위=보라, 촉=초록, 오=금, 군웅=적)
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

  return (
    <div
      onClick={onClick}
      className={`relative flex flex-col rounded-xl border-2 bg-gradient-to-b ${fs.from} ${fs.to} ${
        selected ? "border-yellow-300 -translate-y-3 shadow-lg shadow-yellow-500/30" : fs.border
      } ${dimmed ? "opacity-40" : ""} ${onClick ? "cursor-pointer hover:-translate-y-2" : ""} ${
        small ? "w-28 p-1.5" : "w-40 p-2"
      } transition-transform duration-150 select-none shrink-0`}
    >
      {/* 상단: 국가 + 등급 */}
      <div className="flex items-center justify-between">
        <span className={`${fs.badge} text-white rounded px-1 text-xs font-bold`}>{fs.hanja}</span>
        <span className="text-yellow-300 text-xs tracking-tighter">{"★".repeat(card.grade)}</span>
      </div>

      {/* 초상: public/art/{id}.png가 있으면 사용, 없으면 한자 플레이스홀더 */}
      <div className={`relative flex items-center justify-center overflow-hidden rounded ${small ? "h-14" : "h-24"}`}>
        <span className="text-white/15 font-serif" style={{ fontSize: small ? 40 : 64 }}>
          {fs.hanja}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/art/${gen.id}.png`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
        <span className={`absolute bottom-0 text-white font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${small ? "text-base" : "text-2xl"}`}>
          {gen.name}
        </span>
      </div>

      {!small && <p className="text-center text-white/70 text-[10px] leading-tight mb-1">{gen.title}</p>}
      <p className="text-center text-white/50 text-[9px] mb-1">{roleTag(card)}</p>

      {/* 4수치 */}
      <div className="grid grid-cols-4 gap-0.5 rounded bg-black/40 p-1">
        {STAT_LABELS.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center">
            <span className="text-white/50 text-[8px]">{label}</span>
            <span className={`text-white font-bold ${small ? "text-[10px]" : "text-sm"}`}>{card.stats[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
