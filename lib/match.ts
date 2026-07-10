import { aiPickCard } from "./ai";
import { calcPairPower, calcPower, createCard, shuffle } from "./battle";
import { DECK_SIZE, EARLY_WIN, HAND_SIZE, PHASE_SHIFT_ERA_FLOOR, TURNS } from "./constants";
import { CITIES, ROSTER, SCENARIOS } from "./roster";
import type { CardInstance, City, Difficulty, Scenario, TurnLog } from "./types";

export interface MatchState {
  scenario: Scenario;
  city: City;
  difficulty: Difficulty;
  ownedCount: number; // 내 덱 중 컬렉션 카드 수 (나머지는 용병)
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

// 내 덱: 컬렉션 상위 30장 출전, 모자라면 용병(1등급 랜덤 장수)으로 충원
function buildPlayerDeck(owned: CardInstance[]): { deck: CardInstance[]; ownedCount: number } {
  const statSum = (c: CardInstance) =>
    c.stats.combat + c.stats.politics + c.stats.intellect + c.stats.leadership;
  const picked = [...owned].sort((a, b) => b.grade - a.grade || statSum(b) - statSum(a)).slice(0, DECK_SIZE);
  const fillers = shuffle(ROSTER)
    .slice(0, DECK_SIZE - picked.length)
    .map((r) => createCard(r.id, 1));
  return { deck: shuffle([...picked, ...fillers]), ownedCount: picked.length };
}

export function createMatch(
  difficulty: Difficulty,
  ownedCards: CardInstance[] = [],
  phaseShifts = 0
): MatchState {
  const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];

  const { deck: myCards, ownedCount } = buildPlayerDeck(ownedCards);
  // 상대(AI): 348명 풀에서 랜덤 30명 (같은 장수가 양쪽에 나올 수 있음)
  const oppCards = shuffle(ROSTER).slice(0, DECK_SIZE).map((r) => createCard(r.id));

  // 전환 시점: 30턴을 (횟수+1)등분한 경계 턴 — 몇 번/언제 바뀔지는 공개, 뭘로 바뀔지는 랜덤
  const shiftTurns = Array.from({ length: phaseShifts }, (_, k) =>
    Math.floor((TURNS * (k + 1)) / (phaseShifts + 1)) + 1
  );

  return {
    scenario,
    city,
    difficulty,
    ownedCount,
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

  const myPower = calcPairPower(myCard, mySupport, m.scenario, m.city, m.eraFloor);
  const oppPower = calcPairPower(oppCard, oppSupport, m.scenario, m.city, m.eraFloor);
  const winner: TurnLog["winner"] =
    myPower.total > oppPower.total ? "me" : myPower.total < oppPower.total ? "opp" : "draw";

  const log: TurnLog = {
    turn: m.turn,
    myCard,
    oppCard,
    mySupport: mySupport ?? undefined,
    oppSupport: oppSupport ?? undefined,
    myPower,
    oppPower,
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

  const myScore = m.myScore + (winner === "me" ? 1 : 0);
  const oppScore = m.oppScore + (winner === "opp" ? 1 : 0);
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
