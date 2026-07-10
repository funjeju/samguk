// 게임 초기화 — 원작 데이터(s2_scenarios.json)로 GameState 구성
import scenarioData from "../s2_scenarios.json";
import { CITY_DEFS } from "./cities";
import { SCENARIO_DEFS } from "./scenarios";
import type { CityState, Faction, GameState, Officer } from "./types";

const FACTION_COLORS = [
  "#a855f7", "#22c55e", "#f59e0b", "#3b82f6", "#ef4444", "#14b8a6", "#e879f9", "#84cc16",
  "#f97316", "#06b6d4", "#eab308", "#8b5cf6", "#10b981", "#f43f5e", "#6366f1",
];

interface RawGeneral {
  name: string;
  rawName: string;
  int: number;
  war: number;
  chr: number;
  birth: number | null;
  loyalty_trait: number;
  virtue: number;
  ambition: number;
  compat: number;
  blood: number;
  parent: string | null;
  appearYear?: number | null;
  appearCity?: number | null;
}

const compatDist = (a: number, b: number) => Math.abs(a - b); // 원작 상성은 "선형" 0~100

// 재직 장수를 군주에게 배정: ①혈연 그룹 ②상성 정확 일치 ③시트 인접 순서 보정 ④최근접 상성
function assignFactions(active: RawGeneral[], rulerCount: number): number[] {
  const rulers = active.slice(0, rulerCount);
  const result: (number | null)[] = active.map((_, i) => (i < rulerCount ? i : null));

  for (let i = rulerCount; i < active.length; i++) {
    const g = active[i];
    // ① 혈연 (0은 무혈연)
    if (g.blood > 0) {
      const r = rulers.findIndex((x) => x.blood === g.blood);
      if (r >= 0) {
        result[i] = r;
        continue;
      }
    }
    // ② 상성 정확 일치
    const exact = rulers.findIndex((x) => x.compat === g.compat);
    if (exact >= 0) {
      result[i] = exact;
      continue;
    }
  }
  // ③ 시트 순서 보정: 미배정 장수는 앞뒤로 가장 가까운 확정 이웃과 상성이 비슷하면 편승
  for (let i = rulerCount; i < active.length; i++) {
    if (result[i] !== null) continue;
    let prev: number | null = null;
    for (let j = i - 1; j >= rulerCount; j--) if (result[j] !== null) { prev = result[j]; break; }
    if (prev !== null && compatDist(rulers[prev].compat, active[i].compat) <= 10) {
      result[i] = prev;
      continue;
    }
    // ④ 최근접 상성
    let best = 0;
    let bd = 999;
    rulers.forEach((r, ri) => {
      const d = compatDist(r.compat, active[i].compat);
      if (d < bd) { bd = d; best = ri; }
    });
    result[i] = best;
  }
  return result as number[];
}

let idSeq = 0;
const officerId = (name: string, used: Set<string>) => {
  let id = name;
  while (used.has(id)) id = `${name}_${++idSeq}`;
  used.add(id);
  return id;
};

export function createGame(scenarioId: number, playerRulerName: string): GameState {
  const def = SCENARIO_DEFS.find((s) => s.id === scenarioId)!;
  const raw = (scenarioData as { scenario: number; active: RawGeneral[]; future: RawGeneral[] }[]).find(
    (s) => s.scenario === scenarioId
  )!;

  const rulerCount = def.rulers.length;
  const assign = assignFactions(raw.active, rulerCount);

  // 세력
  const factions: Faction[] = def.rulers.map((r, i) => ({
    id: i,
    rulerId: r.name,
    name: r.name,
    color: FACTION_COLORS[i % FACTION_COLORS.length],
    isPlayer: r.name === playerRulerName,
    trust: 50,
    allies: [],
    alive: true,
  }));
  const playerFactionId = factions.find((f) => f.isPlayer)!.id;

  // 도시
  const cities: Record<number, CityState> = {};
  for (const cd of CITY_DEFS) {
    const owner = def.rulers.findIndex((r) => r.cities.includes(cd.id));
    cities[cd.id] = {
      id: cd.id,
      name: cd.name,
      neighbors: cd.neighbors,
      x: cd.x,
      y: cd.y,
      factionId: owner >= 0 ? owner : null,
      gold: 250 + cd.richness * 90,
      rice: 2500 + cd.richness * 900,
      population: 60000 + cd.richness * 42000,
      land: 25 + cd.richness * 8,
      flood: 25 + cd.richness * 6,
      peace: 50,
      ricePrice: 30 + Math.floor(Math.random() * 40),
      horses: 0,
      weapons: 300 + cd.richness * 100,
    };
  }

  // 장수 (재직)
  const used = new Set<string>();
  const officers: Record<string, Officer> = {};
  const factionCityCursor: Record<number, number> = {};

  raw.active.forEach((g, i) => {
    const fid = assign[i];
    const isRuler = i < rulerCount;
    const rulerDef = def.rulers[fid];
    // 배치: 군주는 첫 도시(본거지), 부하는 세력 도시에 순환 배치
    let cityId: number;
    if (isRuler) {
      cityId = rulerDef.cities[0];
    } else {
      const cur = factionCityCursor[fid] ?? 0;
      cityId = rulerDef.cities[cur % rulerDef.cities.length];
      factionCityCursor[fid] = cur + 1;
    }
    const ruler = raw.active[fid];
    const compatGap = compatDist(ruler.compat, g.compat);
    const id = officerId(g.name, used);
    officers[id] = {
      id,
      name: g.name,
      int: g.int,
      war: g.war,
      chr: g.chr,
      birth: g.birth ?? def.year - 30,
      honor: g.loyalty_trait,
      virtue: g.virtue,
      ambition: g.ambition,
      compat: g.compat,
      blood: g.blood,
      loyalty: isRuler ? 100 : Math.max(35, Math.min(95, 90 - compatGap - Math.floor(g.ambition / 10))),
      soldiers: isRuler ? 5000 : 2000 + Math.floor(g.war * 20),
      trained: 40 + Math.floor(g.war / 5),
      cityId,
      factionId: fid,
      isRuler,
      acted: false,
      wounded: 0,
      alive: true,
    };
  });

  // 재야·후출현 장수
  raw.future.forEach((g) => {
    const id = officerId(g.name, used);
    officers[id] = {
      id,
      name: g.name,
      int: g.int,
      war: g.war,
      chr: g.chr,
      birth: g.birth ?? def.year - 20,
      honor: g.loyalty_trait,
      virtue: g.virtue,
      ambition: g.ambition,
      compat: g.compat,
      blood: g.blood,
      loyalty: 0,
      soldiers: 0,
      trained: 30,
      cityId: null,
      factionId: null,
      isRuler: false,
      acted: false,
      wounded: 0,
      appearYear: g.appearYear ?? def.year,
      appearCity: g.appearCity ?? undefined,
      alive: true,
    };
  });

  const player = def.rulers[playerFactionId];
  return {
    scenario: scenarioId,
    year: def.year,
    month: 1,
    cities,
    officers,
    factions,
    playerFactionId,
    log: [`${def.year}년 1월 — ${def.name}. ${player.name} 세력으로 천하 통일에 도전한다.`],
    pendingBattle: null,
    pendingCaptives: [],
    finished: null,
  };
}
