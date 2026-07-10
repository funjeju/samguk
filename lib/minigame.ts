// 미니게임: 클래식 삼국지 SLG — 내정·등용 중심 (구현명세 §7.5)
// 코에이 삼국지의 장르 문법(턴제 내정 루프)만 오마주, 수치·공식·텍스트는 전부 오리지널 (GDD §4.5)
import { GENERAL_BY_ID, ROSTER } from "./roster";
import { shuffle } from "./battle";

export const MINI = {
  totalQuarters: 12, // 3년 (연 4분기)
  actionsPerQuarter: 2,
  startGold: 800,
  startSoldiers: 3000,
  costDev: 200,
  costCommerce: 200,
  costOrder: 100,
  costTrain: 100,
  costRecruit: 150,
};

export interface MiniState {
  cityName: string;
  year: number;
  quarter: number; // 1~4
  quartersPlayed: number;
  actionsLeft: number;
  gold: number;
  soldiers: number;
  training: number; // 0~100
  dev: number; // 개발 0~100
  commerce: number; // 상업 0~100
  order: number; // 치안 0~100
  generals: string[]; // 합류 장수 (roster id)
  candidates: string[]; // 재야 후보
  recruited: string[]; // 이번 판에 등용 성공한 장수 (카드 지급 대상)
  log: string[];
  finished: boolean;
  score: number;
}

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function createMini(): MiniState {
  const pool = shuffle(ROSTER.map((r) => r.id));
  return {
    cityName: "신야", // 작게 시작하는 유랑 군주의 거점
    year: 190,
    quarter: 1,
    quartersPlayed: 0,
    actionsLeft: MINI.actionsPerQuarter,
    gold: MINI.startGold,
    soldiers: MINI.startSoldiers,
    training: 40,
    dev: 30,
    commerce: 30,
    order: 50,
    generals: pool.slice(0, 2),
    candidates: pool.slice(2, 6),
    recruited: [],
    log: ["난세에 작은 성 하나를 얻었다. 3년 안에 이 땅을 일으켜야 한다."],
    finished: false,
    score: 0,
  };
}

const bestStat = (s: MiniState, key: "politics" | "leadership" | "combat" | "intellect") =>
  Math.max(0, ...s.generals.map((id) => GENERAL_BY_ID[id]?.base[key] ?? 0));

function push(s: MiniState, msg: string) {
  s.log = [...s.log.slice(-11), msg];
}

export type MiniAction = "dev" | "commerce" | "order" | "train" | "search" | { recruit: string };

// 행동 실행 → 새 상태 반환. 행동력 소진 시 자동으로 분기 결산.
export function doAction(prev: MiniState, action: MiniAction): MiniState {
  if (prev.finished || prev.actionsLeft <= 0) return prev;
  const s: MiniState = { ...prev, generals: [...prev.generals], candidates: [...prev.candidates], recruited: [...prev.recruited], log: [...prev.log] };
  const pol = bestStat(s, "politics");
  const intel = bestStat(s, "intellect");

  if (action === "dev") {
    if (s.gold < MINI.costDev) return prev;
    s.gold -= MINI.costDev;
    const gain = rnd(6, 12) + Math.floor(pol / 20);
    s.dev = clamp(s.dev + gain);
    push(s, `개간과 치수에 힘썼다. 개발 +${gain}`);
  } else if (action === "commerce") {
    if (s.gold < MINI.costCommerce) return prev;
    s.gold -= MINI.costCommerce;
    const gain = rnd(6, 12) + Math.floor(pol / 20);
    s.commerce = clamp(s.commerce + gain);
    push(s, `저잣거리에 상인을 불러모았다. 상업 +${gain}`);
  } else if (action === "order") {
    if (s.gold < MINI.costOrder) return prev;
    s.gold -= MINI.costOrder;
    const gain = rnd(8, 14);
    s.order = clamp(s.order + gain);
    push(s, `순찰을 강화해 도적을 몰아냈다. 치안 +${gain}`);
  } else if (action === "train") {
    if (s.gold < MINI.costTrain) return prev;
    s.gold -= MINI.costTrain;
    const lead = bestStat(s, "leadership");
    const gain = rnd(7, 12) + Math.floor(lead / 25);
    s.training = clamp(s.training + gain);
    push(s, `병사들을 조련했다. 훈련 +${gain}`);
  } else if (action === "search") {
    const roll = Math.random();
    if (roll < 0.35) {
      const found = rnd(100, 350) + intel * 2;
      s.gold += found;
      push(s, `수색 중 묻힌 재물을 찾았다. 금 +${found}`);
    } else if (roll < 0.65 && s.candidates.length < 6) {
      const known = new Set([...s.generals, ...s.candidates]);
      const newbie = shuffle(ROSTER.map((r) => r.id)).find((id) => !known.has(id));
      if (newbie) {
        s.candidates = [...s.candidates, newbie];
        push(s, `재야의 인재 ${GENERAL_BY_ID[newbie].name}의 소문을 들었다.`);
      }
    } else {
      push(s, "수색했지만 별다른 것을 찾지 못했다.");
    }
  } else if (typeof action === "object" && "recruit" in action) {
    if (s.gold < MINI.costRecruit) return prev;
    const target = action.recruit;
    if (!s.candidates.includes(target)) return prev;
    s.gold -= MINI.costRecruit;
    const gen = GENERAL_BY_ID[target];
    // 성공률: 내 최고 정치 + 상대 정치가 낮을수록 쉬움
    const p = clamp(35 + pol / 2 - gen.base.politics / 4, 15, 85) / 100;
    if (Math.random() < p) {
      s.generals = [...s.generals, target];
      s.candidates = s.candidates.filter((c) => c !== target);
      s.recruited = [...s.recruited, target];
      push(s, `${gen.name}이(가) 휘하에 들어왔다! (대전 카드 지급)`);
    } else {
      push(s, `${gen.name}이(가) 등용을 거절했다. (성공률 ${Math.round(p * 100)}%)`);
      if (Math.random() < 0.3) s.candidates = s.candidates.filter((c) => c !== target);
    }
  }

  s.actionsLeft -= 1;
  return s.actionsLeft <= 0 ? endQuarter(s) : s;
}

function endQuarter(s: MiniState): MiniState {
  // 수입: 상업 기반, 4분기엔 추수(개발 기반)
  const tax = 60 + Math.floor(s.commerce * 4 * (0.5 + s.order / 200));
  s.gold += tax;
  push(s, `세수가 들어왔다. 금 +${tax}`);
  if (s.quarter === 4) {
    const harvest = Math.floor(s.dev * 6);
    s.gold += harvest;
    push(s, `추수철 — 곡물을 팔아 금 +${harvest}`);
  }

  // 유지비
  const upkeep = Math.floor(s.soldiers / 12);
  s.gold -= upkeep;
  if (s.gold < 0) {
    const desert = Math.floor(s.soldiers * 0.1);
    s.soldiers -= desert;
    s.gold = 0;
    push(s, `군량이 바닥나 병사 ${desert}명이 떠났다.`);
  }

  // 치안 자연 감소 + 낮으면 반란
  s.order = clamp(s.order - rnd(2, 5));
  if (s.order < 25 && Math.random() < 0.4) {
    const loss = rnd(5, 12);
    s.commerce = clamp(s.commerce - loss);
    push(s, `도적 떼가 창궐해 상업 -${loss}`);
  }

  // 연말(4분기) 침공 이벤트
  if (s.quarter === 4) {
    const yearIdx = s.year - 190;
    const enemy = rnd(2000, 3500) + yearIdx * 1500;
    const lead = bestStat(s, "leadership");
    const defense = Math.floor(s.soldiers * (0.5 + s.training / 100) * (1 + lead / 250));
    if (defense >= enemy) {
      const loot = rnd(200, 500);
      s.gold += loot;
      s.order = clamp(s.order + 8);
      push(s, `⚔️ 침공군 ${enemy}을 격퇴했다! (아군 전력 ${defense}) 전리품 금 +${loot}`);
      s.soldiers -= Math.floor(s.soldiers * 0.08);
    } else {
      s.soldiers = Math.floor(s.soldiers * 0.65);
      s.dev = clamp(s.dev - 10);
      s.commerce = clamp(s.commerce - 10);
      s.order = clamp(s.order - 15);
      push(s, `⚔️ 침공군 ${enemy}에 성이 약탈당했다... (아군 전력 ${defense})`);
    }
  }

  // 병사 자연 증원 (치안·개발 좋으면 유입)
  const grow = Math.floor((s.order + s.dev) * 2);
  s.soldiers += grow;

  // 다음 분기
  s.quartersPlayed += 1;
  if (s.quartersPlayed >= MINI.totalQuarters) {
    s.finished = true;
    s.score = s.dev + s.commerce + s.order + Math.floor(s.soldiers / 100) + s.recruited.length * 30;
    push(s, `3년이 지났다. 최종 평가 ${s.score}점 — 등용 ${s.recruited.length}명은 대전 카드로 합류!`);
  } else {
    s.quarter = s.quarter === 4 ? 1 : s.quarter + 1;
    if (s.quarter === 1) s.year += 1;
    s.actionsLeft = MINI.actionsPerQuarter;
  }
  return s;
}
