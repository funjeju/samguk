import { aiPickCard } from "./ai";
import { calcPairPower, calcPower, createCard, shuffle } from "./battle";
import { DECK_SIZE, DUEL, EARLY_WIN, HAND_SIZE, PHASE_SHIFT_ERA_FLOOR, TRAIT_VALUES, TURNS } from "./constants";
import { checkDuelTrigger, resolveDuel } from "./duel";
import { CITIES, GENERAL_BY_ID, ROSTER, SCENARIOS } from "./roster";
import type { CardInstance, City, Difficulty, Scenario, TurnLog } from "./types";

export interface MatchState {
  scenario: Scenario;
  city: City;
  difficulty: Difficulty;
  ownedCount: number; // 내 덱 중 컬렉션 카드 수 (나머지는 용병)
  myAura: number; // 위엄 속성 누적 (아군 전체 배율, 예: 0.03 = +3%)
  oppAura: number;
  phaseShifts: number; // 국면 전환 총 횟수 (0~3, 시작 시 공개)
  shiftTurns: number[]; // 전환이 일어나는 턴 (공개)
  shiftsDone: number;
  shiftNotice: { scenario: Scenario; city: City } | null; // 방금 전환됨 — UI 배너용
  eraFloor?: number; // 전환 후 역사 배율 하한 (완충)
  turn: number; // 1부터
  myScore: number;
  oppScore: number;
  myHand: CardInstance[];
  myDeck: CardInstance[];
  oppHand: CardInstance[];
  oppDeck: CardInstance[];
  logs: TurnLog[];
  finished: boolean;
  result: "win" | "lose" | "draw" | null;
  myTotalPower: number; // 누적 유효 전투력 (동점 판정용)
  oppTotalPower: number;
}

const remainingPower = (cards: CardInstance[], scenario: Scenario, city: City, eraFloor?: number) =>
  cards.reduce((sum, c) => sum + calcPower(c, scenario, city, eraFloor).total, 0);

export type FillMode = "random" | "tiered"; // 용병 충원: 전체 랜덤 / 전투력 권역별 균형

// 내 덱: 지정 카드 우선 출전(덱 편성), 미지정 시 컬렉션 상위 30장, 모자라면 용병(1등급) 충원
function buildPlayerDeck(
  owned: CardInstance[],
  pinnedIds: string[] = [],
  fillMode: FillMode = "random"
): { deck: CardInstance[]; ownedCount: number } {
  const statSum = (c: CardInstance) =>
    c.stats.combat + c.stats.politics + c.stats.intellect + c.stats.leadership;

  // 1) 지정 카드 (덱 편성 화면에서 고른 것)
  const pinned = pinnedIds
    .map((id) => owned.find((c) => c.cardId === id))
    .filter((c): c is CardInstance => !!c)
    .slice(0, DECK_SIZE);
  // 2) 지정이 없으면 기존 방식: 컬렉션 상위 자동 선발
  const picked =
    pinned.length > 0
      ? pinned
      : [...owned].sort((a, b) => b.grade - a.grade || statSum(b) - statSum(a)).slice(0, DECK_SIZE);

  // 3) 용병 충원
  const need = DECK_SIZE - picked.length;
  let fillers: CardInstance[] = [];
  if (need > 0) {
    if (fillMode === "tiered") {
      // 전투력 권역별 균형: 로스터를 가중 전투력 순으로 3등분 → 상/중/하에서 고르게
      const ranked = [...ROSTER].sort(
        (a, b) =>
          b.base.combat * 0.5 + b.base.leadership * 0.3 + b.base.intellect * 0.2 -
          (a.base.combat * 0.5 + a.base.leadership * 0.3 + a.base.intellect * 0.2)
      );
      const third = Math.ceil(ranked.length / 3);
      const tiers = [ranked.slice(0, third), ranked.slice(third, third * 2), ranked.slice(third * 2)];
      const perTier = [Math.ceil(need / 3), Math.ceil(need / 3), need - Math.ceil(need / 3) * 2];
      fillers = tiers.flatMap((tier, i) => shuffle(tier).slice(0, Math.max(0, perTier[i])).map((r) => createCard(r.id, 1)));
      fillers = fillers.slice(0, need);
    } else {
      fillers = shuffle(ROSTER).slice(0, need).map((r) => createCard(r.id, 1));
    }
  }
  return { deck: shuffle([...picked, ...fillers]), ownedCount: picked.length };
}

export function createMatch(
  difficulty: Difficulty,
  ownedCards: CardInstance[] = [],
  phaseShifts = 0,
  pinnedIds: string[] = [],
  fillMode: FillMode = "random"
): MatchState {
  const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];

  const { deck: myCards, ownedCount } = buildPlayerDeck(ownedCards, pinnedIds, fillMode);
  // 상대(AI): 348명 풀에서 랜덤 30명 (같은 장수가 양쪽에 나올 수 있음)
  const oppCards = shuffle(ROSTER).slice(0, DECK_SIZE).map((r) => createCard(r.id));

  // 전환 시점: 30턴을 (횟수+1)등분한 경계 턴 — 몇 번/언제 바뀔지는 공개, 뭘로 바뀔지는 랜덤
  const shiftTurns = Array.from({ length: phaseShifts }, (_, k) =>
    Math.floor((TURNS * (k + 1)) / (phaseShifts + 1)) + 1
  );

  // 위엄(항상형): 덱에 있는 것만으로 아군 전체에 +1.5%씩 — 항상형이라 폭은 작게 (GDD §6)
  const countAura = (cards: CardInstance[]) =>
    cards.filter((c) => c.traits?.includes("majesty")).length * TRAIT_VALUES.majestyPct;

  return {
    scenario,
    city,
    difficulty,
    ownedCount,
    myAura: countAura(myCards),
    oppAura: countAura(oppCards),
    phaseShifts,
    shiftTurns,
    shiftsDone: 0,
    shiftNotice: null,
    turn: 1,
    myScore: 0,
    oppScore: 0,
    myHand: myCards.slice(0, HAND_SIZE),
    myDeck: myCards.slice(HAND_SIZE),
    oppHand: oppCards.slice(0, HAND_SIZE),
    oppDeck: oppCards.slice(HAND_SIZE),
    logs: [],
    finished: false,
    result: null,
    myTotalPower: 0,
    oppTotalPower: 0,
  };
}

// 공개 정보: 상대 잔여(손패+덱) 총 전투력 — 5턴마다 UI에 갱신 표시
export function oppRemainingInfo(m: MatchState) {
  const cards = [...m.oppHand, ...m.oppDeck];
  return {
    total: Math.round(remainingPower(cards, m.scenario, m.city, m.eraFloor)),
    count: cards.length,
  };
}

export function myRemainingInfo(m: MatchState) {
  const cards = [...m.myHand, ...m.myDeck];
  return {
    total: Math.round(remainingPower(cards, m.scenario, m.city, m.eraFloor)),
    count: cards.length,
  };
}

export function playTurn(m: MatchState, myCardId: string, mySupportId?: string): MatchState {
  if (m.finished) return m;
  const myCard = m.myHand.find((c) => c.cardId === myCardId);
  if (!myCard) return m;
  const mySupport = mySupportId ? (m.myHand.find((c) => c.cardId === mySupportId) ?? null) : null;

  const myInfo = myRemainingInfo(m);
  const oppPick = aiPickCard(m.difficulty, m.oppHand, {
    scenario: m.scenario,
    city: m.city,
    eraFloor: m.eraFloor,
    oppRemainingTotal: myInfo.total,
    oppRemainingCount: myInfo.count,
    myDeckCount: m.oppDeck.length,
    turnsLeft: TURNS - m.turn + 1,
  });
  const oppCard = oppPick.main;
  const oppSupport = oppPick.support;

  const myPowerRaw = calcPairPower(myCard, mySupport, m.scenario, m.city, m.eraFloor);
  const oppPowerRaw = calcPairPower(oppCard, oppSupport, m.scenario, m.city, m.eraFloor);

  // 특수 속성 적용 (조건부형 — 발동 시에만, 폭은 크게)
  const last = m.logs[m.logs.length - 1];
  const applyTraits = (
    bd: typeof myPowerRaw,
    main: CardInstance,
    enemySupport: CardInstance | null,
    enemyBd: typeof myPowerRaw,
    aura: number,
    side: "me" | "opp"
  ) => {
    let total = bd.total;
    const notes: string[] = [];
    const t = main.traits ?? [];
    const gen = GENERAL_BY_ID[main.generalId];
    if (t.includes("guardian") && gen.homeCity === m.city.name) {
      total *= TRAIT_VALUES.guardianMult;
      notes.push("수성");
    }
    if (t.includes("vengeance") && last && last.winner === (side === "me" ? "opp" : "me")) {
      total *= TRAIT_VALUES.vengeanceMult;
      notes.push("복수");
    }
    if (t.includes("chain") && last && last.winner === side) {
      const prevMain = side === "me" ? last.myCard : last.oppCard;
      if (GENERAL_BY_ID[prevMain.generalId].faction === gen.faction) {
        total *= TRAIT_VALUES.chainMult;
        notes.push("연환");
      }
    }
    // 설전: 상대가 2:2일 때 그 모사 보정을 감쇄 (상대 총합에서 차감)
    if (t.includes("rhetoric") && enemySupport && enemyBd.supportBonus) {
      notes.push("설전");
    }
    if (aura > 0) {
      total *= 1 + aura;
      notes.push(`위엄+${Math.round(aura * 1000) / 10}%`);
    }
    return { total, notes };
  };

  const myAdj = applyTraits(myPowerRaw, myCard, oppSupport, oppPowerRaw, m.myAura, "me");
  const oppAdj = applyTraits(oppPowerRaw, oppCard, mySupport, myPowerRaw, m.oppAura, "opp");
  // 설전 감쇄 반영
  if ((myCard.traits ?? []).includes("rhetoric") && oppSupport && oppPowerRaw.supportBonus) {
    oppAdj.total -= oppPowerRaw.supportBonus * TRAIT_VALUES.rhetoricReduce;
  }
  if ((oppCard.traits ?? []).includes("rhetoric") && mySupport && myPowerRaw.supportBonus) {
    myAdj.total -= myPowerRaw.supportBonus * TRAIT_VALUES.rhetoricReduce;
  }

  const myPower = {
    ...myPowerRaw,
    total: Math.round(myAdj.total * 10) / 10,
    traitNote: myAdj.notes.length ? myAdj.notes.join("·") : undefined,
  };
  const oppPower = {
    ...oppPowerRaw,
    total: Math.round(oppAdj.total * 10) / 10,
    traitNote: oppAdj.notes.length ? oppAdj.notes.join("·") : undefined,
  };

  // 일기토: 1:1 턴에서 라이벌 매칭 또는 양측 전투 85+ → 합산 판정 이탈, 승자 2점
  let duel: TurnLog["duel"];
  let winner: TurnLog["winner"];
  let winPoints = 1;
  const duelCheck = !mySupport && !oppSupport ? checkDuelTrigger(myCard, oppCard) : { trigger: false, isRival: false };
  if (duelCheck.trigger) {
    duel = resolveDuel(myCard, oppCard, m.scenario, m.city, duelCheck.isRival, m.eraFloor);
    winner = duel.winner;
    winPoints = DUEL.points;
  } else {
    winner = myPower.total > oppPower.total ? "me" : myPower.total < oppPower.total ? "opp" : "draw";
  }

  const log: TurnLog = {
    turn: m.turn,
    myCard,
    oppCard,
    mySupport: mySupport ?? undefined,
    oppSupport: oppSupport ?? undefined,
    myPower,
    oppPower,
    duel,
    winner,
  };

  // 소모 + 드로우 (손패 5장까지 보충)
  const myUsed = new Set([myCard.cardId, ...(mySupport ? [mySupport.cardId] : [])]);
  const oppUsed = new Set([oppCard.cardId, ...(oppSupport ? [oppSupport.cardId] : [])]);
  const myHand = m.myHand.filter((c) => !myUsed.has(c.cardId));
  const oppHand = m.oppHand.filter((c) => !oppUsed.has(c.cardId));
  const myDeck = [...m.myDeck];
  const oppDeck = [...m.oppDeck];
  while (myHand.length < HAND_SIZE && myDeck.length > 0) myHand.push(myDeck.shift()!);
  while (oppHand.length < HAND_SIZE && oppDeck.length > 0) oppHand.push(oppDeck.shift()!);

  const myScore = m.myScore + (winner === "me" ? winPoints : 0);
  const oppScore = m.oppScore + (winner === "opp" ? winPoints : 0);
  const myTotalPower = m.myTotalPower + myPower.total;
  const oppTotalPower = m.oppTotalPower + oppPower.total;

  // 종료 판정: 30턴 소진 / 16점 선취 / 카드 소진
  const outOfCards = myHand.length === 0 || oppHand.length === 0;
  const finished = m.turn >= TURNS || myScore >= EARLY_WIN || oppScore >= EARLY_WIN || outOfCards;

  let result: MatchState["result"] = null;
  if (finished) {
    if (myScore !== oppScore) result = myScore > oppScore ? "win" : "lose";
    else if (myTotalPower !== oppTotalPower) result = myTotalPower > oppTotalPower ? "win" : "lose";
    else result = "draw";
  }

  // 국면 전환: 다음 턴이 전환 시점이면 역사·도시 재추첨 + 완충 하한 적용
  const nextTurn = m.turn + 1;
  let { scenario, city, shiftsDone, shiftNotice, eraFloor } = m;
  shiftNotice = null;
  if (!finished && m.shiftTurns.includes(nextTurn)) {
    scenario = shuffle(SCENARIOS.filter((s) => s.id !== m.scenario.id))[0];
    city = shuffle(CITIES.filter((c) => c.id !== m.city.id))[0];
    shiftsDone += 1;
    shiftNotice = { scenario, city };
    eraFloor = PHASE_SHIFT_ERA_FLOOR;
  }

  return {
    ...m,
    scenario,
    city,
    shiftsDone,
    shiftNotice,
    eraFloor,
    turn: nextTurn,
    myScore,
    oppScore,
    myHand,
    oppHand,
    myDeck,
    oppDeck,
    logs: [...m.logs, log],
    finished,
    result,
    myTotalPower,
    oppTotalPower,
  };
}
