"use client";

import GeneralCard from "@/components/GeneralCard";
import { enhanceCards, fetchCollection } from "@/lib/collection";
import { POWER_W, PROTECT_MAX } from "@/lib/constants";
import { firebaseEnabled } from "@/lib/firebase";
import { GENERAL_BY_ID } from "@/lib/roster";
import { type CardInstance } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export default function Collection({ onBack }: { onBack: () => void }) {
  const [cards, setCards] = useState<CardInstance[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  const [prot, setProt] = useState<string[]>([]); // 보호 지정 카드 (패배해도 안 뺏김)
  const [fillMode, setFillMode] = useState<"random" | "tiered">("random");

  const load = () => fetchCollection().then(setCards).catch(() => setError(true));
  useEffect(() => {
    if (!firebaseEnabled) {
      setError(true);
      return;
    }
    load();
    try {
      setPinned(JSON.parse(localStorage.getItem("deck_pinned") ?? "[]"));
      setProt(JSON.parse(localStorage.getItem("deck_protected") ?? "[]"));
      setFillMode((localStorage.getItem("deck_fillmode") as "random" | "tiered") ?? "random");
    } catch {}
  }, []);

  const saveProt = (next: string[]) => {
    setProt(next);
    localStorage.setItem("deck_protected", JSON.stringify(next));
  };

  const togglePin = (cardId: string) => {
    const next = pinned.includes(cardId)
      ? pinned.filter((id) => id !== cardId)
      : pinned.length < 30
        ? [...pinned, cardId]
        : pinned;
    setPinned(next);
    localStorage.setItem("deck_pinned", JSON.stringify(next));
    // 덱에서 빠진 카드는 보호도 해제 (출격 안 하면 몰수 대상이 아님)
    if (!next.includes(cardId) && prot.includes(cardId)) saveProt(prot.filter((id) => id !== cardId));
  };

  // 보호 토글: 덱에 지정된 카드만, 최대 PROTECT_MAX장
  const toggleProtect = (cardId: string) => {
    if (prot.includes(cardId)) saveProt(prot.filter((id) => id !== cardId));
    else if (prot.length < PROTECT_MAX) saveProt([...prot, cardId]);
  };

  const changeFill = (m: "random" | "tiered") => {
    setFillMode(m);
    localStorage.setItem("deck_fillmode", m);
  };

  // 카드 유효 전투력 (전투 70·통솔 20·지략 10 — 일반 전투 가중과 동일)
  const cardPower = (c: CardInstance) =>
    c.stats.combat * POWER_W.combat + c.stats.leadership * POWER_W.leadership + c.stats.intellect * POWER_W.intellect;

  // 빠른 선택: 전투력 상위 N장을 출전 지정
  const quickPick = (n: number) => {
    if (!cards) return;
    const top = [...cards].sort((a, b) => cardPower(b) - cardPower(a)).slice(0, n).map((c) => c.cardId);
    setPinned(top);
    localStorage.setItem("deck_pinned", JSON.stringify(top));
  };

  // 같은 장수 + 같은 등급끼리 묶기 (강화 재료 표시) — 전투력 높은 순 정렬
  const groups = useMemo(() => {
    if (!cards) return [];
    const map = new Map<string, CardInstance[]>();
    for (const c of cards) {
      const key = `${c.generalId}:${c.grade}`;
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return [...map.values()].sort((a, b) => cardPower(b[0]) - cardPower(a[0]));
  }, [cards]);

  const enhance = async (group: CardInstance[]) => {
    if (busy || group.length < 2) return;
    setBusy(true);
    setNotice(null);
    try {
      const merged = await enhanceCards(group[0], group[1]);
      const gen = GENERAL_BY_ID[merged.generalId];
      setNotice(`${gen.name} ★${group[0].grade} 2장 → ★${merged.grade} 강화 성공!`);
      await load();
    } catch {
      setNotice("강화에 실패했습니다. 다시 시도해주세요.");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-bold">내 컬렉션</h2>
        <button
          onClick={onBack}
          className="rounded-lg border border-white/20 px-6 py-2 text-sm hover:bg-white/10 transition-colors"
        >
          돌아가기
        </button>
      </div>
      {notice && <p className="mb-4 text-amber-300 text-sm">{notice}</p>}
      {error ? (
        <p className="text-white/40">오프라인 상태라 컬렉션을 불러올 수 없습니다.</p>
      ) : cards === null ? (
        <p className="text-white/40">불러오는 중...</p>
      ) : cards.length === 0 ? (
        <p className="text-white/40">아직 카드가 없습니다. 대전에서 승리해 카드를 모아보세요.</p>
      ) : (
        <>
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-black/30 p-2 text-xs">
            <p className="text-amber-300 font-bold mb-1">
              덱 편성 — 지정 {pinned.length}/30
              <span className="text-sky-300 ml-2">🛡 보호 {prot.length}/{PROTECT_MAX}</span>
              <span className="text-white/40 font-normal"> (카드를 눌러 출전 지정 · 지정 카드에 🛡 눌러 보호 — 패배해도 안 뺏김)</span>
            </p>
            <div className="flex gap-2 items-center mb-1.5">
              <span className="text-white/50">전투력 상위 자동 선택:</span>
              {[10, 20, 30].map((n) => (
                <button
                  key={n}
                  onClick={() => quickPick(n)}
                  disabled={!!cards && cards.length < n}
                  className="rounded px-2.5 py-0.5 border border-green-500/40 bg-green-800/40 font-bold hover:bg-green-700/50 disabled:opacity-30 disabled:hover:bg-green-800/40"
                >
                  상위 {n}장
                </button>
              ))}
              <span className="text-white/30">보유 {cards?.length ?? 0}장</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-white/50">용병 충원:</span>
              {(["random", "tiered"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => changeFill(m)}
                  className={`rounded px-2 py-0.5 border ${fillMode === m ? "border-amber-400 bg-amber-800/50" : "border-white/15 hover:bg-white/10"}`}
                >
                  {m === "random" ? "전체 랜덤" : "전투력 권역 균형"}
                </button>
              ))}
              {pinned.length > 0 && (
                <button onClick={() => { setPinned([]); localStorage.setItem("deck_pinned", "[]"); }} className="ml-auto text-white/40 hover:text-white">
                  지정 해제
                </button>
              )}
            </div>
          </div>
          <p className="text-white/50 text-sm mb-4">
            총 {cards.length}장 · 같은 장수 같은 등급 2장 = 강화 가능
          </p>
          <div className="flex gap-2 flex-wrap items-start">
            {groups.map((g) => {
              const pinnedInGroup = g.filter((c) => pinned.includes(c.cardId)).length;
              const pinnedCardId = g.find((c) => pinned.includes(c.cardId))?.cardId;
              const isProtected = !!pinnedCardId && prot.includes(pinnedCardId);
              return (
                <div key={`${g[0].generalId}:${g[0].grade}`} className="relative flex flex-col items-center gap-1">
                  <div
                    className={`relative cursor-pointer rounded-xl ${isProtected ? "ring-2 ring-sky-400" : pinnedInGroup > 0 ? "ring-2 ring-amber-400" : ""}`}
                    onClick={() => togglePin(g.find((c) => !pinned.includes(c.cardId))?.cardId ?? g[0].cardId)}
                  >
                    <GeneralCard card={g[0]} small />
                    {g.length > 1 && (
                      <span className="absolute -top-1.5 -right-1.5 rounded-full bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.5">
                        ×{g.length}
                      </span>
                    )}
                    {pinnedInGroup > 0 && (
                      <span className="absolute -top-1.5 -left-1.5 rounded bg-green-600 text-[9px] font-bold px-1 py-0.5">
                        덱{pinnedInGroup > 1 ? ` ×${pinnedInGroup}` : ""}
                      </span>
                    )}
                    {isProtected && (
                      <span className="absolute top-5 -left-1.5 rounded bg-sky-500 text-[10px] font-bold px-1 py-0.5">🛡</span>
                    )}
                  </div>
                  {pinnedCardId && (
                    <button
                      onClick={() => toggleProtect(pinnedCardId)}
                      disabled={!isProtected && prot.length >= PROTECT_MAX}
                      className={`rounded px-2 py-0.5 text-[11px] font-bold transition-colors ${
                        isProtected
                          ? "bg-sky-600 hover:bg-sky-500"
                          : "border border-sky-500/40 text-sky-300 hover:bg-sky-900/40 disabled:opacity-30"
                      }`}
                    >
                      {isProtected ? "🛡 보호중" : "🛡 보호"}
                    </button>
                  )}
                  {g.length >= 2 && g[0].grade < 4 && (
                    <button
                      onClick={() => enhance(g)}
                      disabled={busy}
                      className="rounded bg-amber-700 px-3 py-0.5 text-[11px] font-bold hover:bg-amber-600 disabled:opacity-40 transition-colors"
                    >
                      강화 ★{g[0].grade}→★{g[0].grade + 1}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
