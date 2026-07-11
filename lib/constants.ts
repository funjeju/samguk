// 튜닝 상수표 — 구현명세 v1 §9
// 플레이테스트 후 이 파일의 숫자만 바꾸면 밸런스가 조정된다.

export const TURNS = 30; // 총 턴 수
export const EARLY_WIN = 16; // 선취 조기 종료 점수
export const HAND_SIZE = 5; // 손패
export const DECK_SIZE = 30; // 덱

// 유효 전투력 가중 (정치는 대전 판정 제외 — 모사·경영 담당)
export const POWER_W = { combat: 0.5, leadership: 0.3, intellect: 0.2 };

// 2:2 모사 보정 가중 (구현명세 §1.3) — 모사의 지략·정치가 장수를 보좌
export const SUPPORT_W = { intellect: 0.3, politics: 0.2 };

// 조정 국면 (정치전 턴): 7·14·21·28턴은 판정 가중이 뒤집힌다 — 문관 카드의 존재 이유
export const COURT_EVERY = 7;
export const COURT_W = { politics: 0.5, intellect: 0.3, leadership: 0.2 };
export const isCourtTurn = (turn: number) => turn % COURT_EVERY === 0;

// 역사 배율 — 폭은 ±0.2 이내로 (미등장 0.6은 과도하다는 피드백 반영)
export const ERA_MULT = {
  peak: 1.2, // 전성기
  active: 1.0, // 활동기
  absent: 0.8, // 미등장/사후
  resistFloor: 0.9, // 저항 속성 하한
};

// 홈 배율 (MVP는 하프 홈만 사용)
export const HOME_MULT = { full: 1.1, half: 1.05, neutral: 1.0 };

// 도시 상성 가산
export const CITY_BONUS = 6;

// 등급 보너스 포인트 (등급 1~4)
export const GRADE_BONUS = [0, 12, 28, 48];
// 랜덤 배분 시 한 수치에 몰 수 있는 최대 비율
export const GRADE_BONUS_MAX_SHARE = 0.6;

// 드랍 등급 확률 (%)
export const GRADE_RATE = [60, 27, 10, 3];

// 보상 장수
export const REWARD = { win: 5, lose: 2, loseStreakBonus: 4, streakAt: 3 };

// 국면 전환 (GDD §2.8)
export const PHASE_SHIFT_MAX = 3; // 게임 생성 시 선택 가능한 최대 횟수
export const PHASE_SHIFT_ERA_FLOOR = 0.85; // 전환 후 역사 배율 하한 (급격한 무력화 완충 — §6)

// 정보 공개 스케줄
export const INFO_POWER_EVERY = 5; // 5턴마다 상대 잔여 총 전투력 갱신
export const INFO_FACTION_DETAIL_TURN = 10; // 국가 구성 상세
export const INFO_ROLE_TURN = 20; // 장수/모사 구분

// 특수 속성 (등급 3~4, 구현명세 §7.4) — "항상형은 작게, 조건부형은 크게" (GDD §6)
export const TRAITS = [
  { id: "majesty", name: "위엄", type: "always", desc: "아군 전체 유효 전투력 +1.5%" },
  { id: "guardian", name: "수성", type: "cond", desc: "연고 전장에서 +12%" },
  { id: "ironwall", name: "철벽", type: "cond", desc: "역사 배율 하한 ×0.9 (저항)" },
  { id: "vengeance", name: "복수", type: "cond", desc: "직전 턴 패배 시 +15%" },
  { id: "chain", name: "연환", type: "cond", desc: "직전 턴 동일 국가 아군 승리 시 +10%" },
  { id: "rhetoric", name: "설전", type: "cond", desc: "상대 모사 보정 50% 감쇄" },
  { id: "overawe", name: "위압", type: "cond", desc: "이 카드로 승리하면 상대는 다음 턴 최강 카드를 낼 수 없다" },
] as const;
export const TRAIT_VALUES = {
  majestyPct: 0.015,
  guardianMult: 1.12,
  ironwallFloor: 0.9,
  vengeanceMult: 1.15,
  chainMult: 1.1,
  rhetoricReduce: 0.5,
};
export const TRAITS_PER_GRADE = [0, 0, 1, 2]; // 등급 1~4

// 일기토 (GDD §2.6, 구현명세 §7.2)
export const DUEL = {
  combatThreshold: 85, // 라이벌이 아니어도 양측 전투 85+ 면 발동
  rounds: 5, // 총 합
  winAt: 3, // 선취 합
  points: 2, // 일기토 승자는 그 턴 2점
  clampMin: 0.05, // 반전 확률 하한 — "여포도 한 방에"의 낭만
  clampMax: 0.35, // 상한 — 실력 존중
};

// 카드 타입 판정 임계
export const WARRIOR_COMBAT_MIN = 75; // 전투 75+ = 장수
export const STRATEGIST_INTELLECT_MIN = 85; // 지략 85+ = 모사
