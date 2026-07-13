"use client";

import GeneralCard from "@/components/GeneralCard";
import { createCard, rollGrade, shuffle } from "@/lib/battle";
import { confiscateCards, saveMatchResult } from "@/lib/collection";
import { REWARD } from "@/lib/constants";
import { firebaseEnabled } from "@/lib/firebase";
import { type MatchState } from "@/lib/match";
import { ROSTER } from "@/lib/roster";
import { type CardInstance } from "@/lib/types";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function Result({ match, onRestart }: { match: MatchState; onRestart: () => void }) {
  const won = match.result === "win";
  const lost = match.result === "lose";
  const [rewards, setRewards] = useState<CardInstance[] | null>(null);
  const [saved, setSaved] = useState<"saving" | "saved" | "local">("saving");
  const [points, setPoints] = useState<number | null>(null);
  const [taken, setTaken] = useState<CardInstance[] | null>(null); // 몰수당한 카드

  useEffect(() => {
    let alive = true;
    const localFallback = () => {
      const n = won ? REWARD.win : REWARD.lose;
      if (alive) {
        setRewards(shuffle([...ROSTER]).slice(0, n).map((r) => createCard(r.id, rollGrade())));
        setSaved("local");
      }
    };
    if (!firebaseEnabled || !match.result) {
      localFallback();
      return;
    }
    saveMatchResult(match.result)
      .then(({ rewards, pointsGained }) => {
        if (alive) {
          setRewards(rewards);
          setPoints(pointsGained);
          setSaved("saved");
        }
      })
      .catch(localFallback);

    // 패배 몰수: 출격한 내 소유 카드 중 랜덤 1~2장 (보호 지정 제외)
    if (lost) {
      const playedIds = match.logs.flatMap((l) => [l.myCard?.cardId, l.mySupport?.cardId]).filter(Boolean) as string[];
      let protectedIds: string[] = [];
      try {
        protectedIds = JSON.parse(localStorage.getItem("deck_protected") ?? "[]");
      } catch {}
      confiscateCards(playedIds, protectedIds)
        .then((t) => alive && setTaken(t))
        .catch(() => alive && setTaken([]));
    } else {
      setTaken([]);
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <motion.h2
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`text-6xl font-bold ${won ? "text-green-400" : match.result === "draw" ? "text-white/60" : "text-red-400"}`}
      >
        {won ? "승리" : match.result === "draw" ? "무승부" : "패배"}
      </motion.h2>
      <p className="text-white/60 text-xl">
        {match.myScore} : {match.oppScore}
        <span className="text-sm text-white/40 ml-3">
          (누적 전투력 {Math.round(match.myTotalPower)} : {Math.round(match.oppTotalPower)})
        </span>
      </p>

      {points !== null && (
        <p className="text-amber-300 text-sm font-bold">+{points} 포인트 획득</p>
      )}

      {/* 패배 몰수 카드 */}
      {lost && taken !== null && (
        taken.length > 0 ? (
          <div className="text-center rounded-lg border border-red-500/40 bg-red-950/30 p-3">
            <p className="text-red-300 font-bold mb-2">빼앗긴 장수 {taken.length}명</p>
            <div className="flex gap-2 flex-wrap justify-center opacity-70 grayscale">
              {taken.map((c) => (
                <GeneralCard key={c.cardId} card={c} small />
              ))}
            </div>
            <p className="text-white/40 text-xs mt-2">보호 지정하면 다음엔 지킬 수 있습니다 (덱 편성 화면)</p>
          </div>
        ) : (
          <p className="text-white/40 text-xs">몰수된 카드 없음 (출격한 소유 카드가 없거나 모두 보호됨)</p>
        )
      )}

      <div className="text-center">
        {rewards === null ? (
          <p className="text-white/40">보상 지급 중...</p>
        ) : (
          <>
            <p className="text-amber-400 mb-3">보상 카드 {rewards.length}장</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {rewards.map((c, i) => (
                <motion.div
                  key={c.cardId}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.15 }}
                >
                  <GeneralCard card={c} small />
                </motion.div>
              ))}
            </div>
            <p className="text-white/30 text-xs mt-3">
              {saved === "saved" ? "컬렉션에 저장되었습니다" : "※ 오프라인 — 이번 보상은 저장되지 않습니다"}
            </p>
          </>
        )}
      </div>

      <button
        onClick={onRestart}
        className="rounded-lg bg-amber-600 px-12 py-3 text-lg font-bold hover:bg-amber-500 transition-colors"
      >
        다시 대전
      </button>
    </div>
  );
}
