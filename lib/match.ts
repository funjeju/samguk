import { aiPickCard } from "./ai";
import { calcPower, createCard, shuffle } from "./battle";
import { DECK_SIZE, EARLY_WIN, HAND_SIZE, TURNS } from "./constants";
import { CITIES, ROSTER, SCENARIOS } from "./roster";
import type { CardInstance, City, Difficulty, Scenario, TurnLog } from "./types";

export interface MatchState {
  scenario: Scenario;
  city: City;
  difficulty: Difficulty;
  ownedCount: number; // 내 덱 중 컬렉션 카드 수 (나머지는 용병)
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

const remainingPower = (cards: CardInstance[], scenario: Scenario, city: City) =>
  cards.reduce((sum, c) => sum + calcPower(c, scenario, city).total, 0);

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

export function createMatch(difficulty: Difficulty, ownedCards: CardInstance[] = []): MatchState {
  const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];

  const { deck: myCards, ownedCount } = buildPlayerDeck(ownedCards);
  // 상대(AI): 348명 풀에서 랜덤 30명 (같은 장수가 양쪽에 나올 수 있음)
  const oppCards = shuffle(ROSTER).slice(0, DECK_SIZE).map((r) => createCard(r.id));

  return {
    scenario,
    city,
    difficulty,
    ownedCount,
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
    total: Math.round(remainingPower(cards, m.scenario, m.city)),
    count: cards.length,
  };
}

export function myRemainingInfo(m: MatchState) {
  const cards = [...m.myHand, ...m.myDeck];
  return {
    total: Math.round(remainingPower(cards, m.scenario, m.city)),
    count: cards.length,
  };
}

export function playTurn(m: MatchState, myCardId: string): MatchState {
  if (m.finished) return m;
  const myCard = m.myHand.find((c) => c.cardId === myCardId);
  if (!myCard) return m;

  const myInfo = myRemainingInfo(m);
  const oppCard = aiPickCard(m.difficulty, m.oppHand, m.scenario, m.city, myInfo.total, myInfo.count);

  const myPower = calcPower(myCard, m.scenario, m.city);
  const oppPower = calcPower(oppCard, m.scenario, m.city);
  const winner: TurnLog["winner"] =
    myPower.total > oppPower.total ? "me" : myPower.total < oppPower.total ? "opp" : "draw";

  const log: TurnLog = { turn: m.turn, myCard, oppCard, myPower, oppPower, winner };

  // 소모 + 드로우
  const myHand = m.myHand.filter((c) => c.cardId !== myCard.cardId);
  const oppHand = m.oppHand.filter((c) => c.cardId !== oppCard.cardId);
  const myDeck = [...m.myDeck];
  const oppDeck = [...m.oppDeck];
  if (myDeck.length > 0) myHand.push(myDeck.shift()!);
  if (oppDeck.length > 0) oppHand.push(oppDeck.shift()!);

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

  return {
    ...m,
    turn: m.turn + 1,
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
