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

// 역사 배율
export const ERA_MULT = {
  peak: 1.2, // 전성기
  active: 1.0, // 활동기
  absent: 0.6, // 미등장/사후
  resistFloor: 0.8, // 저항 속성 하한 (2차)
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
export const PHASE_SHIFT_ERA_FLOOR = 0.7; // 전환 후 역사 배율 하한 (급격한 무력화 완충 — §6)

// 정보 공개 스케줄
export const INFO_POWER_EVERY = 5; // 5턴마다 상대 잔여 총 전투력 갱신
export const INFO_FACTION_DETAIL_TURN = 10; // 국가 구성 상세
export const INFO_ROLE_TURN = 20; // 장수/모사 구분

// 카드 타입 판정 임계
export const WARRIOR_COMBAT_MIN = 75; // 전투 75+ = 장수
export const STRATEGIST_INTELLECT_MIN = 85; // 지략 85+ = 모사
