"use client";

import { fetchCollection } from "@/lib/collection";
import { firebaseEnabled } from "@/lib/firebase";
import { createMatch, type MatchState } from "@/lib/match";
import { type CardInstance, type Difficulty } from "@/lib/types";
import { useEffect, useState } from "react";
import Intro from "@/components/screens/Intro";
import StartSequence from "@/components/screens/StartSequence";
import Battle from "@/components/screens/Battle";
import Pvp from "@/components/screens/Pvp";
import Result from "@/components/screens/Result";
import Collection from "@/components/screens/Collection";

type Screen = "intro" | "sequence" | "battle" | "result" | "collection" | "pvp";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [match, setMatch] = useState<MatchState | null>(null);
  const [pvpJoinId, setPvpJoinId] = useState<string | null>(null);

  // 초대 링크(?room=xxx)로 접속 시 PvP 자동 입장
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("room");
    if (id) {
      setPvpJoinId(id);
      setScreen("pvp");
    }
  }, []);

  const startMatch = async (d: Difficulty, shifts: number) => {
    let owned: CardInstance[] = [];
    if (firebaseEnabled) {
      try {
        owned = await fetchCollection();
      } catch {
        // 오프라인 — 용병 덱으로 진행
      }
    }
    // 덱 편성 (컬렉션 화면에서 지정) + 용병 충원 방식
    let pinned: string[] = [];
    let fillMode: "random" | "tiered" = "random";
    try {
      pinned = JSON.parse(localStorage.getItem("deck_pinned") ?? "[]");
      fillMode = (localStorage.getItem("deck_fillmode") as "random" | "tiered") ?? "random";
    } catch {}
    setMatch(createMatch(d, owned, shifts, pinned, fillMode));
    setScreen("sequence");
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-white">
      {screen === "intro" && (
        <Intro onStart={startMatch} onCollection={() => setScreen("collection")} onPvp={() => setScreen("pvp")} />
      )}
      {screen === "collection" && <Collection onBack={() => setScreen("intro")} />}
      {screen === "pvp" && (
        <Pvp
          joinId={pvpJoinId}
          onBack={() => {
            setPvpJoinId(null);
            window.history.replaceState(null, "", "/");
            setScreen("intro");
          }}
        />
      )}
      {screen === "sequence" && match && <StartSequence match={match} onDone={() => setScreen("battle")} />}
      {screen === "battle" && match && (
        <Battle match={match} setMatch={setMatch} onFinished={() => setScreen("result")} />
      )}
      {screen === "result" && match && (
        <Result
          match={match}
          onRestart={() => {
            setMatch(null);
            setScreen("intro");
          }}
        />
      )}
    </main>
  );
}
