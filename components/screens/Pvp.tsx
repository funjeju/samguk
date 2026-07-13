"use client";

import GeneralCard from "@/components/GeneralCard";
import { calcPower } from "@/lib/battle";
import { fetchCollection, saveMatchResult } from "@/lib/collection";
import { isCourtTurn, POWER_W, TURNS } from "@/lib/constants";
import { currentUser, firebaseEnabled } from "@/lib/firebase";
import { buildPvpDeck, createRoom, hostResolveTurn, joinRoom, listenOpenRooms, listenPick, listenRoom, submitPick, type OpenRoom, type PvpPickData, type PvpRoom, type PvpSide, type PvpTurnResult } from "@/lib/pvp";
import { CITIES, SCENARIOS } from "@/lib/roster";
import { type CardInstance, type DuelResult, type TurnLog } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import { RevealPanel } from "@/components/screens/Battle";

export default function Pvp({ joinId, onBack }: { joinId: string | null; onBack: () => void }) {
  const [phase, setPhase] = useState<"init" | "lobby" | "waiting" | "playing" | "done" | "error">("init");
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [joining, setJoining] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(joinId);
  const [side, setSide] = useState<PvpSide>("host");
  const [room, setRoom] = useState<PvpRoom | null>(null);
  const [deck, setDeck] = useState<CardInstance[]>([]);
  const [hand, setHand] = useState<CardInstance[]>([]);
  const drawIdx = useRef(5);
  const [turnNo, setTurnNo] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [supportSel, setSupportSel] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reveal, setReveal] = useState<TurnLog | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [oppRemaining, setOppRemaining] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const resolving = useRef(false);
  const prevInfo = useRef<{ winner: PvpSide | "draw" | null; host?: CardInstance; guest?: CardInstance }>({ winner: null });
  const savedRef = useRef(false);
  const usedRef = useRef<{ main: string; support: string | null }>({ main: "", support: null });

  const isStrategist = (c: CardInstance) => c.stats.intellect >= 85;

  // 초기화: 덱 구성 → 방 생성 or 참가
  useEffect(() => {
    if (!firebaseEnabled) {
      setPhase("error");
      return;
    }
    (async () => {
      try {
        let owned: CardInstance[] = [];
        try {
          owned = await fetchCollection();
        } catch {}
        let pinnedIds: string[] = [];
        let fillMode: "random" | "tiered" = "random";
        try {
          pinnedIds = JSON.parse(localStorage.getItem("deck_pinned") ?? "[]");
          fillMode = (localStorage.getItem("deck_fillmode") as "random" | "tiered") ?? "random";
        } catch {}
        const myDeck = buildPvpDeck(owned, pinnedIds, fillMode);
        setDeck(myDeck);
        setHand(myDeck.slice(0, 5));
        drawIdx.current = 5;

        if (joinId) {
          const r = await joinRoom(joinId, myDeck);
          if (!r) {
            setPhase("error");
            return;
          }
          setSide(r.hostUid === (await import("@/lib/firebase")).currentUser()?.uid ? "host" : "guest");
          setRoomId(joinId);
        } else {
          setPhase("lobby");
        }
      } catch {
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 로비: 대기 중인 방 목록 구독
  useEffect(() => {
    if (phase !== "lobby") return;
    return listenOpenRooms(setRooms);
  }, [phase]);

  // 로비에서 방 만들기 / 참전
  const openRoom = async () => {
    if (joining || deck.length === 0) return;
    setJoining(true);
    try {
      const id = await createRoom(deck);
      setRoomId(id);
      setSide("host");
      setPhase("waiting");
    } catch {
      setPhase("error");
    } finally {
      setJoining(false);
    }
  };

  const enterRoom = async (id: string) => {
    if (joining || deck.length === 0) return;
    setJoining(true);
    try {
      const r = await joinRoom(id, deck);
      if (!r) {
        setJoining(false);
        return; // 이미 찬 방 등 — 목록에 그대로 두고 재시도 가능
      }
      const uid = (await import("@/lib/firebase")).currentUser()?.uid;
      setSide(r.hostUid === uid ? "host" : "guest");
      setRoomId(id);
    } catch {
      setPhase("error");
    } finally {
      setJoining(false);
    }
  };

  // 방 구독
  useEffect(() => {
    if (!roomId) return;
    return listenRoom(roomId, (r) => {
      setRoom(r);
      if (r.status === "playing") setPhase((p) => (p === "init" || p === "waiting" ? "playing" : p));
      if (r.status === "done") setPhase("done");
    });
  }, [roomId]);

  // 현재 턴 pick 구독 (양측 제출 → host 판정 → result 재생)
  useEffect(() => {
    if (!roomId || phase !== "playing" || !room) return;
    return listenPick(roomId, turnNo, (data) => {
      if (data.result) {
        if (!reveal) showResult(data);
        return;
      }
      if (side === "host" && data.host && data.guest && !resolving.current) {
        resolving.current = true;
        hostResolveTurn(roomId, room, turnNo, data.host, data.guest, prevInfo.current.winner, prevInfo.current)
          .finally(() => (resolving.current = false));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, phase, turnNo, room?.status, submitted]);

  const flipDuel = (d: DuelResult): DuelResult => ({
    ...d,
    favorite: d.favorite === "me" ? "opp" : "me",
    winner: d.winner === "me" ? "opp" : "me",
    rounds: d.rounds.map((r) => ({ ...r, winner: r.winner === "me" ? "opp" : "me" })),
  });

  const showResult = (data: { host?: PvpPickData; guest?: PvpPickData; result?: PvpTurnResult }) => {
    const res = data.result!;
    const mine = side === "host" ? data.host! : data.guest!;
    const theirs = side === "host" ? data.guest! : data.host!;
    const log: TurnLog = {
      turn: turnNo,
      myCard: mine.card,
      oppCard: theirs.card,
      mySupport: mine.support ?? undefined,
      oppSupport: theirs.support ?? undefined,
      myPower: side === "host" ? res.hostPower : res.guestPower,
      oppPower: side === "host" ? res.guestPower : res.hostPower,
      duel: res.duel ? (side === "host" ? res.duel : flipDuel(res.duel)) : undefined,
      winner: res.winner === "draw" ? "draw" : res.winner === side ? "me" : "opp",
    };
    prevInfo.current = { winner: res.winner === "draw" ? "draw" : res.winner, host: data.host?.card, guest: data.guest?.card };
    if (turnNo >= 5) setOppRemaining(theirs.remaining);
    setReveal(log);
    setFlipped(false);
    setTimeout(() => setFlipped(true), 700);
  };

  const commit = async () => {
    if (!selected || submitted || !roomId) return;
    const card = hand.find((c) => c.cardId === selected)!;
    const support = supportSel ? (hand.find((c) => c.cardId === supportSel) ?? null) : null;
    usedRef.current = { main: card.cardId, support: support?.cardId ?? null };
    const remainCards = [...hand.filter((c) => c.cardId !== card.cardId && c.cardId !== support?.cardId), ...deck.slice(drawIdx.current)];
    const scenario = SCENARIOS.find((s) => s.id === room!.scenarioId)!;
    const city = CITIES.find((c) => c.id === room!.cityId)!;
    const remaining = Math.round(
      remainCards.reduce(
        (x, c) => x + (c.stats.combat * POWER_W.combat + c.stats.leadership * POWER_W.leadership + c.stats.intellect * POWER_W.intellect),
        0
      )
    );
    void scenario;
    void city;
    setSubmitted(true);
    await submitPick(roomId, turnNo, side, { card, support, remaining, count: remainCards.length });
  };

  const nextTurn = () => {
    // 사용 카드 소모 + 드로우
    const used = usedRef.current;
    let newHand = hand.filter((c) => c.cardId !== used.main && c.cardId !== used.support);
    while (newHand.length < 5 && drawIdx.current < deck.length) {
      newHand = [...newHand, deck[drawIdx.current]];
      drawIdx.current += 1;
    }
    setHand(newHand);
    setReveal(null);
    setSelected(null);
    setSupportSel(null);
    setSubmitted(false);
    setTurnNo((t) => t + 1);
  };

  // 종료 시 보상 저장 (1회)
  useEffect(() => {
    if (phase === "done" && room?.winner && !savedRef.current && firebaseEnabled) {
      savedRef.current = true;
      const r = room.winner === "draw" ? "draw" : room.winner === side ? "win" : "lose";
      saveMatchResult(r).catch(() => {});
    }
  }, [phase, room, side]);

  const clickCard = (c: CardInstance) => {
    if (submitted || reveal) return;
    if (selected === c.cardId) {
      setSelected(supportSel);
      setSupportSel(null);
    } else if (supportSel === c.cardId) {
      setSupportSel(null);
    } else if (selected && isStrategist(c)) {
      setSupportSel(c.cardId);
    } else {
      setSelected(c.cardId);
      setSupportSel(null);
    }
  };

  /* ── 렌더 ── */
  if (phase === "error")
    return (
      <PvpShell onBack={onBack}>
        <p className="text-red-300">방을 찾을 수 없거나 접속에 실패했습니다.</p>
      </PvpShell>
    );
  if (phase === "init")
    return (
      <PvpShell onBack={onBack}>
        <p className="text-white/50">덱을 구성하는 중...</p>
      </PvpShell>
    );
  if (phase === "lobby") {
    const myUid = currentUser()?.uid;
    return (
      <PvpShell onBack={onBack}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-amber-300 font-bold text-xl">대전 방 목록</p>
          <button
            onClick={openRoom}
            disabled={joining}
            className="rounded bg-amber-600 px-4 py-2 text-sm font-bold hover:bg-amber-500 disabled:opacity-40"
          >
            + 새 방 만들기
          </button>
        </div>
        {rooms.length === 0 ? (
          <p className="text-white/40 text-sm py-8">열린 방이 없습니다. 새 방을 만들어 상대를 기다려보세요.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rooms.map((r) => {
              const mine = r.hostUid === myUid;
              const secsAgo = Math.max(0, Math.round((Date.now() - r.createdAt) / 1000));
              const ago = secsAgo < 60 ? `${secsAgo}초 전` : `${Math.round(secsAgo / 60)}분 전`;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-white/15 bg-black/30 px-4 py-3"
                >
                  <div className="flex-1 text-left">
                    <p className="font-bold text-sm">
                      {r.hostName ?? "익명 군주"} {mine && <span className="text-white/40 font-normal">(내 방)</span>}
                    </p>
                    <p className="text-white/50 text-xs">
                      덱 전투력 {r.hostPower} · {ago}
                    </p>
                  </div>
                  <button
                    onClick={() => enterRoom(r.id)}
                    disabled={joining || mine}
                    className="rounded bg-green-700 px-4 py-1.5 text-sm font-bold hover:bg-green-600 disabled:opacity-30"
                  >
                    {mine ? "대기 중" : "참전"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </PvpShell>
    );
  }
  if (phase === "waiting") {
    const link = `${window.location.origin}/?room=${roomId}`;
    return (
      <PvpShell onBack={onBack}>
        <p className="text-amber-300 font-bold text-xl mb-2">방이 열렸습니다</p>
        <p className="text-white/60 text-sm mb-4">아래 링크를 친구에게 보내세요. 접속하면 바로 대전이 시작됩니다.</p>
        <div className="flex gap-2 items-center justify-center">
          <code className="rounded bg-black/50 px-3 py-2 text-xs">{link}</code>
          <button
            onClick={() => {
              navigator.clipboard.writeText(link).then(() => setCopied(true));
            }}
            className="rounded bg-amber-600 px-4 py-2 text-sm font-bold hover:bg-amber-500"
          >
            {copied ? "복사됨!" : "복사"}
          </button>
        </div>
        <p className="text-white/40 text-xs mt-4 animate-pulse">상대를 기다리는 중...</p>
      </PvpShell>
    );
  }
  if (phase === "done" && room) {
    const myScore = side === "host" ? room.hostScore : room.guestScore;
    const oppScore = side === "host" ? room.guestScore : room.hostScore;
    const won = room.winner === side;
    return (
      <PvpShell onBack={onBack}>
        <p className={`text-5xl font-bold mb-2 ${won ? "text-green-400" : room.winner === "draw" ? "text-white/60" : "text-red-400"}`}>
          {won ? "승리" : room.winner === "draw" ? "무승부" : "패배"}
        </p>
        <p className="text-white/60 text-xl">
          {myScore} : {oppScore}
        </p>
        <p className="text-white/40 text-sm mt-2">보상 카드가 컬렉션에 지급되었습니다</p>
        <button onClick={onBack} className="mt-4 rounded-lg bg-amber-600 px-10 py-2.5 font-bold hover:bg-amber-500">
          돌아가기
        </button>
      </PvpShell>
    );
  }
  if (!room) return null;

  const scenario = SCENARIOS.find((s) => s.id === room.scenarioId)!;
  const city = CITIES.find((c) => c.id === room.cityId)!;
  const myScore = side === "host" ? room.hostScore : room.guestScore;
  const oppScore = side === "host" ? room.guestScore : room.hostScore;

  return (
    <div className="flex min-h-screen flex-col p-4 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm">
        <div className="flex gap-4 text-white/70 items-center">
          <span className="text-red-400">{scenario.name}</span>
          <span className="text-blue-400">{city.name}</span>
          <span className="text-white/30 text-xs">PvP</span>
          {isCourtTurn(turnNo) && (
            <span className="rounded bg-indigo-800/80 px-2 py-0.5 text-xs font-bold text-indigo-100">📜 조정 국면</span>
          )}
        </div>
        <div className="font-bold text-lg">
          <span className="text-green-400">{myScore}</span>
          <span className="text-white/40 mx-2">{Math.min(turnNo, TURNS)} / {TURNS} 턴</span>
          <span className="text-red-400">{oppScore}</span>
        </div>
        <div className="text-white/50 text-xs text-right">
          상대 잔여 전투력 {oppRemaining !== null ? <b className="text-white/90">{oppRemaining}</b> : <span className="text-white/30">? (5턴부터)</span>}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center py-6">
        {reveal ? (
          <RevealPanel log={reveal} flipped={flipped} onNext={nextTurn} finished={false} />
        ) : submitted ? (
          <div className="text-center">
            <p className="text-amber-300 text-lg animate-pulse">상대의 선택을 기다리는 중...</p>
            <p className="text-white/30 text-xs mt-2">동시 공개 — 서로의 카드는 공개 순간까지 비밀입니다</p>
          </div>
        ) : (
          <p className="text-white/30 text-lg">손패에서 카드를 골라 출진시키세요</p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 pb-4">
        <div className="flex gap-2 justify-center flex-wrap">
          {hand.map((c) => {
            const preview = calcPower(c, scenario, city, undefined, isCourtTurn(turnNo) ? "court" : "battle").total;
            return (
              <div key={c.cardId} className="relative flex flex-col items-center gap-0.5">
                <GeneralCard
                  card={c}
                  selected={selected === c.cardId || supportSel === c.cardId}
                  dimmed={submitted || !!reveal}
                  onClick={() => clickCard(c)}
                />
                <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] text-amber-200">
                  이 판 전투력 <b>{Math.round(preview)}</b>
                </span>
                {supportSel === c.cardId && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-blue-500 px-2 py-0.5 text-[10px] font-bold">모사</span>
                )}
              </div>
            );
          })}
        </div>
        <button
          onClick={commit}
          disabled={!selected || submitted || !!reveal}
          className={`rounded-lg px-12 py-2.5 text-lg font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${
            supportSel ? "bg-blue-700 hover:bg-blue-600" : "bg-red-700 hover:bg-red-600"
          }`}
        >
          {supportSel ? "2:2 출진" : "출진"}
        </button>
      </div>
    </div>
  );
}

function PvpShell({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-red-400/80 tracking-[0.4em] text-sm">친 구 대 결</p>
      {children}
      <button onClick={onBack} className="mt-2 text-white/40 text-sm underline hover:text-white">
        메인으로
      </button>
    </div>
  );
}
