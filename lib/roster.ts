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

// 역사 시나리오 6개 — 시대에 따라 전성기/미등장 판정이 크게 달라진다
export const SCENARIOS: Scenario[] = [
  {
    id: "yellowturban",
    year: 184,
    name: "황건적의 난 (184년)",
    ruleTexts: [
      "난세의 서막 — 군웅 소속 카드 전투 +5",
      "천공장군 — 장각 통솔 +8",
      "이 시대 미등장 장수는 전투력 ×0.6",
    ],
    statMods: [
      { faction: "군웅", stat: "combat", add: 5 },
      { generalId: "장각", stat: "leadership", add: 8 },
    ],
  },
  {
    id: "antidong",
    year: 190,
    name: "반동탁 연합 (190년)",
    ruleTexts: [
      "제후 연합 — 오(吳) 소속 카드 통솔 +5",
      "낙양의 폭군 — 동탁 전투 +8",
      "이 시대 미등장 장수는 전투력 ×0.6",
    ],
    statMods: [
      { faction: "오", stat: "leadership", add: 5 },
      { generalId: "동탁", stat: "combat", add: 8 },
    ],
  },
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
  {
    id: "chibi",
    year: 208,
    name: "적벽대전 (208년)",
    ruleTexts: [
      "장강의 불길 — 오(吳) 소속 카드 지략 +5",
      "미주랑 — 주유 지략 +8",
      "이 시대 미등장 장수는 전투력 ×0.6",
    ],
    statMods: [
      { faction: "오", stat: "intellect", add: 5 },
      { generalId: "주유", stat: "intellect", add: 8 },
    ],
  },
  {
    id: "jingzhou",
    year: 219,
    name: "형주 쟁탈전 (219년)",
    ruleTexts: [
      "한중왕의 기세 — 촉(蜀) 소속 카드 통솔 +5",
      "수엄칠군 — 관우 전투 +8",
      "이 시대 미등장 장수는 전투력 ×0.6",
    ],
    statMods: [
      { faction: "촉", stat: "leadership", add: 5 },
      { generalId: "관우", stat: "combat", add: 8 },
    ],
  },
  {
    id: "northern",
    year: 228,
    name: "북벌 (228년)",
    ruleTexts: [
      "출사표 — 촉(蜀) 소속 카드 지략 +5",
      "와룡의 집념 — 제갈량 지략 +8",
      "이 시대 미등장 장수는 전투력 ×0.6",
    ],
    statMods: [
      { faction: "촉", stat: "intellect", add: 5 },
      { generalId: "제갈량", stat: "intellect", add: 8 },
    ],
  },
];
