import { calcPower } from "./battle";
import type { CardInstance, City, Difficulty, Scenario } from "./types";

// AI 카드 선택 — 구현명세 §5
// easy: 랜덤 / normal: 탐욕(최강 카드) / hard: 공개 정보 기반 이길 판엔 강카드, 질 판엔 최약체 버리기
export function aiPickCard(
  difficulty: Difficulty,
  hand: CardInstance[],
  scenario: Scenario,
  city: City,
  opponentRemainingTotal: number, // 공개 정보: 상대(플레이어) 잔여 총 전투력
  opponentRemainingCount: number,
  eraFloor?: number // 국면 전환 후 역사 배율 하한
): CardInstance {
  if (hand.length === 1) return hand[0];

  if (difficulty === "easy") {
    return hand[Math.floor(Math.random() * hand.length)];
  }

  const powers = hand.map((c) => ({ card: c, p: calcPower(c, scenario, city, eraFloor).total }));
  powers.sort((a, b) => b.p - a.p);

  if (difficulty === "normal") {
    return powers[0].card;
  }

  // hard: 상대 잔여 평균 전투력 추정 대비 판단
  const estimate = opponentRemainingCount > 0 ? opponentRemainingTotal / opponentRemainingCount : 0;
  if (powers[0].p > estimate * 1.1) return powers[0].card; // 이길 만한 판 → 최강
  return powers[powers.length - 1].card; // 어려운 판 → 최약체 버리기
}
