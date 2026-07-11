// 삼국지2 재구성 엔진 — 타입 정의
// 구조·규칙은 원작(1989)을 조사 자료 기반으로 재현, 수치·텍스트는 오리지널 (GDD §4.5)
//
// 원작 핵심 구조 (리서치 확정):
// - 월 단위 턴. 도시의 명령 횟수 = 그 도시 주둔 장수 수 (장수 1명 = 월 1행동)
// - 1월 금 수입 / 7월 쌀 수확 (세율 없음). 시여·임시징수 별도
// - 쌀 시세 매월 변동 (도시별) — 사고팔기 재테크
// - 군주 신뢰도(전 영토 공통) + 장수 충성도 + 민충성도 3층 구조
// - 승리 = 41개 주 통일 / 패배 = 군주 사망(후계 없음) 또는 전 영토 상실

export interface Officer {
  id: string;
  name: string;
  int: number; // 지력 — 내정 효율, 계략, 화계
  war: number; // 무력 — 전투, 일기토
  chr: number; // 매력 — 등용, 포상, 시여, 탐색
  birth: number; // 생년 (수명 처리)
  honor: number; // 의리 (배신 저항, 숨은 수치)
  virtue: number; // 인덕 (숨은 수치)
  ambition: number; // 야망 (독립·배신 성향)
  compat: number; // 상성 0~100 (군주와 가까울수록 등용·충성 유리)
  blood: number; // 혈연 그룹 (0 = 없음)
  // 런타임
  loyalty: number; // 충성도 0~100 (군주는 항상 100)
  soldiers: number; // 지휘 병사 (최대 10000 = 원작 100유닛의 스케일업)
  trained: number; // 훈련도 0~100
  cityId: number | null;
  factionId: number | null; // null = 재야
  isRuler: boolean;
  acted: boolean; // 이번 달 행동 완료 여부 (도시 명령 수 = 미행동 장수 수)
  wounded: number; // 부상 (남은 개월, 0 = 정상)
  discovered?: boolean; // 재야가 탐색으로 발견됐는지 (발견해야 등용 가능)
  appearYear?: number;
  appearCity?: number;
  alive: boolean;
}

export interface CityState {
  id: number; // 1~41 (원작 국번호)
  name: string;
  neighbors: number[];
  x: number; // 지도 좌표 (0~100)
  y: number;
  factionId: number | null; // null = 공백지
  gold: number;
  rice: number;
  population: number;
  land: number; // 토지가치 0~100
  flood: number; // 치수도 0~100
  peace: number; // 민충성도 0~100
  ricePrice: number; // 쌀 시세: 금 100으로 살 수 있는 쌀 (15~88 변동)
  horses: number; // 말 (전투·포상용)
  weapons: number; // 무기 (병사 무장률)
}

export interface Faction {
  id: number;
  rulerId: string;
  name: string;
  color: string;
  isPlayer: boolean;
  trust: number; // 신뢰도 0~100 (시작 50) — 전 영토 공통
  allies: number[]; // 동맹 세력 id
  alive: boolean;
}

// 커맨드 (실행 장수 1명 소모 — acted 처리)
export type Command =
  | { type: "develop"; officerId: string; gold: number } // 개발 (지력)
  | { type: "flood"; officerId: string; gold: number } // 치수 (지력)
  | { type: "give"; officerId: string; rice: number } // 시여 → 민충성 (매력)
  | { type: "levy"; officerId: string } // 임시징수 → 금·쌀 +, 민충·신뢰 -
  | { type: "trade"; officerId: string; mode: "buyRice" | "sellRice" | "buyHorse" | "buyWeapon"; amount: number }
  | { type: "reward"; officerId: string; targetId: string; gold: number } // 포상 → 충성
  | { type: "search"; officerId: string } // 탐색 (매력) → 재야 발견
  | { type: "recruit"; officerId: string; targetId: string } // 등용 (매력·상성·신뢰도·충성)
  | { type: "conscript"; officerId: string; amount: number } // 징병 (금·쌀 소모, 민충 하락)
  | { type: "train"; officerId: string } // 훈련
  | { type: "move"; officerIds: string[]; toCity: number; gold: number; rice: number } // 이동 (장수+물자)
  | { type: "transport"; officerId: string; toCity: number; gold: number; rice: number } // 수송 (물자만, 자국 인접)
  | { type: "war"; officerIds: string[]; toCity: number } // 출병 (인접만)
  | { type: "plot"; officerId: string; kind: "forgery"; targetOfficerId: string } // 계략: 위서
  | { type: "diplomacy"; officerId: string; kind: "ally" | "gift"; targetFactionId: number; gold?: number };

export interface BattleSide {
  factionId: number;
  units: { officerId: string; soldiers: number; morale: number }[];
}

export interface BattleReport {
  attacker: number;
  defender: number | null;
  cityId: number;
  rounds: string[]; // 전투 로그 (일 단위 요약)
  duel?: { a: string; b: string; winner: string; log: string[] };
  winner: "attacker" | "defender";
  captured: string[]; // 포로 장수 id
}

export interface GameState {
  scenario: number;
  year: number;
  month: number; // 1~12
  cities: Record<number, CityState>;
  officers: Record<string, Officer>;
  factions: Faction[];
  playerFactionId: number;
  log: string[];
  pendingBattle: BattleReport | null; // UI 연출용
  pendingCaptives: string[]; // 처리 대기 포로
  rewardUsed: boolean; // 포상은 한 달에 1명만 (원작 규칙)
  finished: "won" | "lost" | null;
}
