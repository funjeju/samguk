import { calcPairPower, calcPower, calcSupportBonus } from "./battle";
import { STRATEGIST_INTELLECT_MIN } from "./constants";
import type { CardInstance, City, Difficulty, Scenario } from "./types";

export interface AiPick {
  main: CardInstance;
  support: CardInstance | null; // 2:2 시 모사
}

export interface AiContext {
  scenario: Scenario;
  city: City;
  eraFloor?: number;
  oppRemainingTotal: number; // 공개 정보: 상대(플레이어) 잔여 총 전투력
  oppRemainingCount: number;
  myDeckCount: number; // AI 잔여 덱
  turnsLeft: number;
}

// AI 카드 선택 — 구현명세 §5
// easy: 랜덤 / normal: 탐욕(최강 카드) / hard: 이길 판엔 강카드(필요시 2:2), 질 판엔 최약체 버리기
export function aiPickCard(difficulty: Difficulty, hand: CardInstance[], ctx: AiContext): AiPick {
  if (hand.length === 1) return { main: hand[0], support: null };

  if (difficulty === "easy") {
    return { main: hand[Math.floor(Math.random() * hand.length)], support: null };
  }

  const { scenario, city, eraFloor } = ctx;
  const powers = hand.map((c) => ({ card: c, p: calcPower(c, scenario, city, eraFloor).total }));
  powers.sort((a, b) => b.p - a.p);

  if (difficulty === "normal") {
    return { main: powers[0].card, support: null };
  }

  // hard: 상대 잔여 평균 전투력 추정 대비 판단
  const estimate = ctx.oppRemainingCount > 0 ? ctx.oppRemainingTotal / ctx.oppRemainingCount : 0;
  const best = powers[0];

  if (best.p > estimate * 1.1) return { main: best.card, support: null }; // 단독으로 충분

  // 단독으론 밀리는 판 — 카드 여유가 있으면 모사를 붙여 뒤집기 시도
  const slack = hand.length + ctx.myDeckCount - ctx.turnsLeft; // 2:2 가능 여유분
  if (slack >= 1) {
    const strategists = hand.filter(
      (c) => c.cardId !== best.card.cardId && c.stats.intellect >= STRATEGIST_INTELLECT_MIN
    );
    if (strategists.length > 0) {
      const sup = strategists.reduce((a, b) =>
        calcSupportBonus(a, scenario, city, eraFloor) >= calcSupportBonus(b, scenario, city, eraFloor) ? a : b
      );
      const pairTotal = calcPairPower(best.card, sup, scenario, city, eraFloor).total;
      if (pairTotal > estimate * 1.15) return { main: best.card, support: sup };
    }
  }

  return { main: powers[powers.length - 1].card, support: null }; // 어려운 판 → 최약체 버리기
}
