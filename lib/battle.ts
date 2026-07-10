import {
  CITY_BONUS,
  ERA_MULT,
  GRADE_BONUS,
  GRADE_BONUS_MAX_SHARE,
  GRADE_RATE,
  HOME_MULT,
  POWER_W,
} from "./constants";
import { GENERAL_BY_ID } from "./roster";
import type { CardInstance, City, PowerBreakdown, Scenario, Stats } from "./types";

let seq = 0;
const newCardId = () => `c_${Date.now().toString(36)}_${(seq++).toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

export function rollGrade(): 1 | 2 | 3 | 4 {
  const r = Math.random() * 100;
  let acc = 0;
  for (let i = 0; i < 4; i++) {
    acc += GRADE_RATE[i];
    if (r < acc) return (i + 1) as 1 | 2 | 3 | 4;
  }
  return 1;
}

// 등급 보너스 포인트를 4수치에 랜덤 배분 (한 수치 60% 초과 금지, 99 클램프)
export function createCard(generalId: string, grade?: 1 | 2 | 3 | 4): CardInstance {
  const gen = GENERAL_BY_ID[generalId];
  const gr = grade ?? rollGrade();
  const bonus = GRADE_BONUS[gr - 1];
  const stats: Stats = { ...gen.base };
  const keys: (keyof Stats)[] = ["combat", "politics", "intellect", "leadership"];
  const maxPer = Math.floor(bonus * GRADE_BONUS_MAX_SHARE);
  const given: Record<string, number> = { combat: 0, politics: 0, intellect: 0, leadership: 0 };
  let remaining = bonus;
  while (remaining > 0) {
    const candidates = keys.filter((k) => given[k] < maxPer && stats[k] < 99);
    if (candidates.length === 0) break;
    const k = candidates[Math.floor(Math.random() * candidates.length)];
    stats[k] += 1;
    given[k] += 1;
    remaining -= 1;
  }
  return { cardId: newCardId(), generalId, grade: gr, stats, createdAt: Date.now() };
}

// 유효 전투력 계산 — 구현명세 §1.2
export function calcPower(card: CardInstance, scenario: Scenario, city: City): PowerBreakdown {
  const gen = GENERAL_BY_ID[card.generalId];

  // 시나리오 수치 보정 (판정 전 가산)
  const s: Stats = { ...card.stats };
  for (const mod of scenario.statMods) {
    if ((mod.faction && gen.faction === mod.faction) || (mod.generalId && gen.id === mod.generalId)) {
      s[mod.stat] = Math.min(99, s[mod.stat] + mod.add);
    }
  }

  const weighted = s.combat * POWER_W.combat + s.leadership * POWER_W.leadership + s.intellect * POWER_W.intellect;

  // 역사 배율
  const y = scenario.year;
  let eraMult: number = ERA_MULT.active;
  let eraLabel: PowerBreakdown["eraLabel"] = "활동기";
  if (y >= gen.peakFrom && y <= gen.peakTo) {
    eraMult = ERA_MULT.peak;
    eraLabel = "전성기";
  } else if (y < gen.activeFrom || y > gen.activeTo) {
    eraMult = ERA_MULT.absent;
    eraLabel = "미등장";
  }

  // 홈 배율 (MVP: 연고지 하프 홈만)
  const isHome = gen.homeCity === city.name;
  const homeMult = isHome ? HOME_MULT.half : HOME_MULT.neutral;

  // 도시 상성 가산
  const cityBonus = s[city.bonusStat] >= city.bonusThreshold ? CITY_BONUS : 0;

  const total = weighted * eraMult * homeMult + cityBonus;
  return {
    weighted: Math.round(weighted * 10) / 10,
    eraMult,
    eraLabel,
    homeMult,
    homeLabel: isHome ? "홈" : "중립",
    cityBonus,
    total: Math.round(total * 10) / 10,
  };
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
