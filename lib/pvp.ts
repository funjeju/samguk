// PvP (친구 대결) — Firestore 턴 동기화
// 구조: 덱·손패는 각자 로컬 비밀, 매 턴 "낸 카드"만 공개 제출 → 정보전 유지 (GDD §2.9)
// 판정: 방장 클라이언트가 결과를 계산·기록(권위자), 양쪽이 같은 결과를 재생 — 지인전 v1
import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { calcPairPower, createCard, shuffle } from "./battle";
import { DECK_SIZE, DUEL, EARLY_WIN, TRAIT_VALUES, TURNS } from "./constants";
import { checkDuelTrigger, resolveDuel } from "./duel";
import { db, ensureUser } from "./firebase";
import { CITIES, GENERAL_BY_ID, ROSTER, SCENARIOS } from "./roster";
import type { CardInstance, City, DuelResult, PowerBreakdown, Scenario } from "./types";

export type PvpSide = "host" | "guest";

export interface PvpPickData {
  card: CardInstance;
  support: CardInstance | null;
  remaining: number; // 잔여 총 전투력 (공개 정보용)
  count: number;
}

export interface PvpTurnResult {
  hostPower: PowerBreakdown;
  guestPower: PowerBreakdown;
  duel: DuelResult | null; // host 관점 (winner: "me"=host)
  winner: PvpSide | "draw";
  points: number;
}

export interface PvpRoom {
  status: "waiting" | "playing" | "done";
  hostUid: string;
  guestUid?: string;
  scenarioId: string;
  cityId: string;
  turn: number;
  hostScore: number;
  guestScore: number;
  hostAura: number;
  guestAura: number;
  hostPower: number; // 시작 총 전투력 (첫 공개용)
  guestPower: number;
  winner?: PvpSide | "draw";
  createdAt: number;
}

const roomRef = (id: string) => doc(db!, "rooms", id);
const pickRef = (id: string, turn: number) => doc(db!, "rooms", id, "picks", String(turn));

export function buildPvpDeck(owned: CardInstance[], pinnedIds: string[], fillMode: "random" | "tiered"): CardInstance[] {
  const statSum = (c: CardInstance) => c.stats.combat + c.stats.politics + c.stats.intellect + c.stats.leadership;
  const pinned = pinnedIds.map((id) => owned.find((c) => c.cardId === id)).filter((c): c is CardInstance => !!c);
  const picked = (pinned.length > 0 ? pinned : [...owned].sort((a, b) => b.grade - a.grade || statSum(b) - statSum(a))).slice(0, DECK_SIZE);
  const need = DECK_SIZE - picked.length;
  let fillers: CardInstance[] = [];
  if (need > 0) {
    if (fillMode === "tiered") {
      const ranked = [...ROSTER].sort(
        (a, b) =>
          b.base.combat * 0.5 + b.base.leadership * 0.3 + b.base.intellect * 0.2 -
          (a.base.combat * 0.5 + a.base.leadership * 0.3 + a.base.intellect * 0.2)
      );
      const third = Math.ceil(ranked.length / 3);
      const tiers = [ranked.slice(0, third), ranked.slice(third, third * 2), ranked.slice(third * 2)];
      const per = [Math.ceil(need / 3), Math.ceil(need / 3), need - Math.ceil(need / 3) * 2];
      fillers = tiers.flatMap((t, i) => shuffle(t).slice(0, Math.max(0, per[i])).map((r) => createCard(r.id, 1))).slice(0, need);
    } else {
      fillers = shuffle(ROSTER).slice(0, need).map((r) => createCard(r.id, 1));
    }
  }
  return shuffle([...picked, ...fillers]);
}

export const deckAura = (deck: CardInstance[]) =>
  deck.filter((c) => c.traits?.includes("majesty")).length * TRAIT_VALUES.majestyPct;

export const deckPower = (deck: CardInstance[], scenario: Scenario, city: City) =>
  Math.round(deck.reduce((x, c) => x + calcPairPower(c, null, scenario, city).total, 0));

const newRoomId = () => Math.random().toString(36).slice(2, 8);

// 방 생성 (방장): 시나리오·도시 확정 + 내 덱 정보 등록
export async function createRoom(deck: CardInstance[]): Promise<string> {
  const user = await ensureUser();
  const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const id = newRoomId();
  const room: PvpRoom = {
    status: "waiting",
    hostUid: user.uid,
    scenarioId: scenario.id,
    cityId: city.id,
    turn: 1,
    hostScore: 0,
    guestScore: 0,
    hostAura: deckAura(deck),
    guestAura: 0,
    hostPower: deckPower(deck, scenario, city),
    guestPower: 0,
    createdAt: Date.now(),
  };
  await setDoc(roomRef(id), room);
  return id;
}

export async function joinRoom(roomId: string, deck: CardInstance[]): Promise<PvpRoom | null> {
  const user = await ensureUser();
  const snap = await getDoc(roomRef(roomId));
  if (!snap.exists()) return null;
  const room = snap.data() as PvpRoom;
  if (room.status !== "waiting" && room.guestUid !== user.uid) return null;
  const scenario = SCENARIOS.find((s) => s.id === room.scenarioId)!;
  const city = CITIES.find((c) => c.id === room.cityId)!;
  if (room.status === "waiting" && room.hostUid !== user.uid) {
    await updateDoc(roomRef(roomId), {
      status: "playing",
      guestUid: user.uid,
      guestAura: deckAura(deck),
      guestPower: deckPower(deck, scenario, city),
    });
  }
  return (await getDoc(roomRef(roomId))).data() as PvpRoom;
}

export function listenRoom(roomId: string, cb: (room: PvpRoom) => void): () => void {
  return onSnapshot(roomRef(roomId), (snap) => {
    if (snap.exists()) cb(snap.data() as PvpRoom);
  });
}

export async function submitPick(roomId: string, turn: number, side: PvpSide, pick: PvpPickData): Promise<void> {
  await setDoc(pickRef(roomId, turn), { [side]: JSON.parse(JSON.stringify(pick)) }, { merge: true });
}

export function listenPick(
  roomId: string,
  turn: number,
  cb: (data: { host?: PvpPickData; guest?: PvpPickData; result?: PvpTurnResult }) => void
): () => void {
  return onSnapshot(pickRef(roomId, turn), (snap) => {
    if (snap.exists()) cb(snap.data() as { host?: PvpPickData; guest?: PvpPickData; result?: PvpTurnResult });
  });
}

// 방장 전용: 양측 제출 완료 시 턴 판정 계산·기록 (특수 속성 + 일기토 포함)
export async function hostResolveTurn(
  roomId: string,
  room: PvpRoom,
  turn: number,
  host: PvpPickData,
  guest: PvpPickData,
  prevWinner: PvpSide | "draw" | null,
  prevCards: { host?: CardInstance; guest?: CardInstance }
): Promise<void> {
  const scenario = SCENARIOS.find((s) => s.id === room.scenarioId)!;
  const city = CITIES.find((c) => c.id === room.cityId)!;

  const hostRaw = calcPairPower(host.card, host.support, scenario, city);
  const guestRaw = calcPairPower(guest.card, guest.support, scenario, city);

  const applyTraits = (
    bd: PowerBreakdown,
    main: CardInstance,
    side: PvpSide,
    aura: number,
    enemySupport: CardInstance | null,
    enemyBd: PowerBreakdown
  ) => {
    let total = bd.total;
    const notes: string[] = [];
    const t = main.traits ?? [];
    const gen = GENERAL_BY_ID[main.generalId];
    if (t.includes("guardian") && gen.homeCity === city.name) {
      total *= TRAIT_VALUES.guardianMult;
      notes.push("수성");
    }
    if (t.includes("vengeance") && prevWinner && prevWinner !== "draw" && prevWinner !== side) {
      total *= TRAIT_VALUES.vengeanceMult;
      notes.push("복수");
    }
    const prevMain = prevCards[side];
    if (t.includes("chain") && prevWinner === side && prevMain && GENERAL_BY_ID[prevMain.generalId].faction === gen.faction) {
      total *= TRAIT_VALUES.chainMult;
      notes.push("연환");
    }
    if (t.includes("rhetoric") && enemySupport && enemyBd.supportBonus) notes.push("설전");
    if (aura > 0) {
      total *= 1 + aura;
      notes.push(`위엄+${Math.round(aura * 1000) / 10}%`);
    }
    return { total, notes };
  };

  const hAdj = applyTraits(hostRaw, host.card, "host", room.hostAura, guest.support, guestRaw);
  const gAdj = applyTraits(guestRaw, guest.card, "guest", room.guestAura, host.support, hostRaw);
  if ((host.card.traits ?? []).includes("rhetoric") && guest.support && guestRaw.supportBonus) {
    gAdj.total -= guestRaw.supportBonus * TRAIT_VALUES.rhetoricReduce;
  }
  if ((guest.card.traits ?? []).includes("rhetoric") && host.support && hostRaw.supportBonus) {
    hAdj.total -= hostRaw.supportBonus * TRAIT_VALUES.rhetoricReduce;
  }

  const hostPower = { ...hostRaw, total: Math.round(hAdj.total * 10) / 10, traitNote: hAdj.notes.join("·") || undefined };
  const guestPower = { ...guestRaw, total: Math.round(gAdj.total * 10) / 10, traitNote: gAdj.notes.join("·") || undefined };

  // 일기토 (1:1 턴)
  let duel: DuelResult | null = null;
  let winner: PvpSide | "draw";
  let points = 1;
  const duelCheck = !host.support && !guest.support ? checkDuelTrigger(host.card, guest.card) : { trigger: false, isRival: false };
  if (duelCheck.trigger) {
    duel = resolveDuel(host.card, guest.card, scenario, city, duelCheck.isRival); // "me" = host
    winner = duel.winner === "me" ? "host" : "guest";
    points = DUEL.points;
  } else {
    winner = hostPower.total > guestPower.total ? "host" : hostPower.total < guestPower.total ? "guest" : "draw";
  }

  const hostScore = room.hostScore + (winner === "host" ? points : 0);
  const guestScore = room.guestScore + (winner === "guest" ? points : 0);
  const finished = turn >= TURNS || hostScore >= EARLY_WIN || guestScore >= EARLY_WIN;

  const result: PvpTurnResult = { hostPower, guestPower, duel, winner, points };
  await setDoc(pickRef(roomId, turn), { result: JSON.parse(JSON.stringify(result)) }, { merge: true });
  await updateDoc(roomRef(roomId), {
    turn: turn + 1,
    hostScore,
    guestScore,
    ...(finished
      ? {
          status: "done",
          winner: hostScore !== guestScore ? (hostScore > guestScore ? "host" : "guest") : "draw",
        }
      : {}),
    ...(host.remaining != null ? {} : {}),
  });
  void deleteField;
}
