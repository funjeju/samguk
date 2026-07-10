import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { createCard, rollGrade, shuffle } from "./battle";
import { REWARD } from "./constants";
import { db, ensureUser } from "./firebase";
import { ROSTER } from "./roster";
import type { CardInstance } from "./types";

export interface UserRecord {
  wins: number;
  losses: number;
  draws: number;
  lossStreak: number;
}

// 대전 결과 저장: 전적 갱신 + 보상 카드 생성·소유권 기록 (거래 대비 스키마 — GDD §5.2)
// 연패 보호: 3연패 이후 패배 보상 2장 → 4장 (구현명세 §0-5)
export async function saveMatchResult(result: "win" | "lose" | "draw"): Promise<{
  rewards: CardInstance[];
  record: UserRecord;
}> {
  const user = await ensureUser();
  const userRef = doc(db!, "users", user.uid);

  const record = await runTransaction(db!, async (tx) => {
    const snap = await tx.get(userRef);
    const prev: UserRecord = (snap.data() as UserRecord | undefined) ?? {
      wins: 0,
      losses: 0,
      draws: 0,
      lossStreak: 0,
    };
    const next: UserRecord = {
      wins: prev.wins + (result === "win" ? 1 : 0),
      losses: prev.losses + (result === "lose" ? 1 : 0),
      draws: prev.draws + (result === "draw" ? 1 : 0),
      lossStreak: result === "lose" ? prev.lossStreak + 1 : 0,
    };
    tx.set(userRef, next, { merge: true });
    return { prev, next };
  });

  const n =
    result === "win"
      ? REWARD.win
      : record.prev.lossStreak + 1 > REWARD.streakAt
        ? REWARD.loseStreakBonus
        : REWARD.lose;

  const rewards = shuffle([...ROSTER])
    .slice(0, n)
    .map((r) => createCard(r.id, rollGrade()));

  await Promise.all(
    rewards.map((c) =>
      setDoc(doc(db!, "cards", c.cardId), {
        ...c,
        ownerId: user.uid,
        history: [{ event: "drop", at: Date.now(), detail: `대전 ${result}` }],
      })
    )
  );

  return { rewards, record: record.next };
}

export async function fetchCollection(): Promise<CardInstance[]> {
  const user = await ensureUser();
  const q = query(collection(db!, "cards"), where("ownerId", "==", user.uid));
  const snap = await getDocs(q);
  const cards = snap.docs.map((d) => d.data() as CardInstance);
  return cards.sort((a, b) => b.grade - a.grade || b.createdAt - a.createdAt);
}

// 강화: 같은 장수 + 같은 등급 2장 합성 → 등급 +1 (보너스 랜덤가중 재추첨 — 구현명세 §6)
// 소모된 개체 이력은 결과 카드 history에 병합 (거래 대비 — GDD §5.2)
export async function enhanceCards(a: CardInstance, b: CardInstance): Promise<CardInstance> {
  if (a.generalId !== b.generalId || a.grade !== b.grade || a.grade >= 4 || a.cardId === b.cardId) {
    throw new Error("강화 조건이 맞지 않습니다");
  }
  const user = await ensureUser();
  const merged = createCard(a.generalId, (a.grade + 1) as 2 | 3 | 4);
  const batch = writeBatch(db!);
  batch.delete(doc(db!, "cards", a.cardId));
  batch.delete(doc(db!, "cards", b.cardId));
  batch.set(doc(db!, "cards", merged.cardId), {
    ...merged,
    ownerId: user.uid,
    history: [{ event: "enhance", at: Date.now(), detail: `${a.cardId} + ${b.cardId}` }],
  });
  await batch.commit();
  return merged;
}

// 미니게임 등용 → 대전 카드 지급 (미니게임↔대전 자원 연결 — 구현명세 §0-6)
export async function grantCards(generalIds: string[]): Promise<CardInstance[]> {
  const user = await ensureUser();
  const cards = generalIds.map((id) => createCard(id, rollGrade()));
  await Promise.all(
    cards.map((c) =>
      setDoc(doc(db!, "cards", c.cardId), {
        ...c,
        ownerId: user.uid,
        history: [{ event: "drop", at: Date.now(), detail: "미니게임 등용" }],
      })
    )
  );
  return cards;
}

export async function fetchRecord(): Promise<UserRecord | null> {
  const user = await ensureUser();
  const snap = await getDoc(doc(db!, "users", user.uid));
  return (snap.data() as UserRecord | undefined) ?? null;
}
