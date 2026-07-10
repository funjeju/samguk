export type Faction = "위" | "촉" | "오" | "군웅";

export interface Stats {
  combat: number; // 전투
  politics: number; // 정치
  intellect: number; // 지략
  leadership: number; // 통솔
}

// 장수 원형 (로스터의 고정 데이터)
export interface General {
  id: string;
  name: string;
  faction: Faction;
  base: Stats;
  activeFrom: number; // 활동기 시작 연도
  activeTo: number;
  peakFrom: number; // 전성기 구간
  peakTo: number;
  homeCity: string; // 연고 도시
  title: string; // 카드 한 줄 문구
  bonds?: string[]; // 인연 (2:2 시너지 후보 — 2차)
  rivals?: string[]; // 일기토 라이벌 후보 (2차)
}

// 카드 개체 (거래 대비 고유 ID — GDD §5.2)
export interface CardInstance {
  cardId: string;
  generalId: string;
  grade: 1 | 2 | 3 | 4;
  stats: Stats; // 등급 보너스 랜덤가중 반영 최종값
  createdAt: number;
}

export interface City {
  id: string;
  name: string;
  faction: Faction; // 연고 국가
  ruleText: string;
  // 상성 규칙: 해당 수치가 임계 이상이면 CITY_BONUS 가산
  bonusStat: keyof Stats;
  bonusThreshold: number;
}

export interface Scenario {
  id: string;
  year: number;
  name: string;
  ruleTexts: string[];
  // 시나리오 룰: 조건에 맞는 카드에 수치 가산 (판정 전 적용)
  statMods: { faction?: Faction; generalId?: string; stat: keyof Stats; add: number }[];
}

export interface PowerBreakdown {
  weighted: number; // 4수치 가중합 (시나리오 보정 반영)
  eraMult: number;
  eraLabel: "전성기" | "활동기" | "미등장";
  homeMult: number;
  homeLabel: "홈" | "중립";
  cityBonus: number;
  total: number;
}

export type Difficulty = "easy" | "normal" | "hard";

export interface TurnLog {
  turn: number;
  myCard: CardInstance;
  oppCard: CardInstance;
  myPower: PowerBreakdown;
  oppPower: PowerBreakdown;
  winner: "me" | "opp" | "draw";
}
