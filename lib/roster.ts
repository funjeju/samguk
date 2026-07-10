import rosterData from "./roster_full.json";
import type { City, General, Scenario } from "./types";

// 로스터 348명 — scripts/build_roster.py가 생성 (기준: 삼국지2 등장 장수)
// 수치는 역대 시리즈 정규화 평균의 독자 밸런싱, 연도·연고·인연은 14PK 매칭
export const ROSTER: General[] = rosterData as General[];

export const GENERAL_BY_ID = Object.fromEntries(ROSTER.map((r) => [r.id, r]));

// 전투 도시 3개 — 구현명세 §4.2
export const CITIES: City[] = [
  {
    id: "xuchang",
    name: "허창",
    faction: "위",
    ruleText: "조정의 중심 — 정치 80 이상 카드 +6",
    bonusStat: "politics",
    bonusThreshold: 80,
  },
  {
    id: "chengdu",
    name: "성도",
    faction: "촉",
    ruleText: "험지 통솔 — 통솔 85 이상 카드 +6",
    bonusStat: "leadership",
    bonusThreshold: 85,
  },
  {
    id: "jianye",
    name: "건업",
    faction: "오",
    ruleText: "수전 지략 — 지략 85 이상 카드 +6",
    bonusStat: "intellect",
    bonusThreshold: 85,
  },
];

// 역사 시나리오 (MVP 1개: 관도대전) — 구현명세 §4.1
export const SCENARIOS: Scenario[] = [
  {
    id: "guandu",
    year: 200,
    name: "관도대전 (200년)",
    ruleTexts: [
      "난세의 간웅 — 위(魏) 소속 카드 통솔 +5",
      "몰락하는 명가 — 원소 전투 +8",
      "이 시대 미등장 장수는 전투력 ×0.6",
    ],
    statMods: [
      { faction: "위", stat: "leadership", add: 5 },
      { generalId: "원소", stat: "combat", add: 8 },
    ],
  },
];
