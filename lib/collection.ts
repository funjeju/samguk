import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
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

export async function fetchRecord(): Promise<UserRecord | null> {
  const user = await ensureUser();
  const snap = await getDoc(doc(db!, "users", user.uid));
  return (snap.data() as UserRecord | undefined) ?? null;
}
