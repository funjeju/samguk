"use client";

import { GENERAL_BY_ID } from "@/lib/roster";
import { type CardInstance, type Difficulty, type Faction } from "@/lib/types";

export const DIFF_LABEL: Record<Difficulty, string> = { easy: "쉬움", normal: "보통", hard: "어려움" };

export function factionRatio(cards: CardInstance[]): string {
  const count: Record<string, number> = {};
  for (const c of cards) {
    const f = GENERAL_BY_ID[c.generalId].faction;
    count[f] = (count[f] ?? 0) + 1;
  }
  return (["위", "촉", "오", "군웅"] as Faction[])
    .filter((f) => count[f])
    .map((f) => `${f} ${count[f]}`)
    .join(" · ");
}
