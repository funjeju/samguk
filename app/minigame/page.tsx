"use client";

import GeneralCard from "@/components/GeneralCard";
import { createCard } from "@/lib/battle";
import { grantCards } from "@/lib/collection";
import { firebaseEnabled } from "@/lib/firebase";
import { createMini, doAction, MINI, type MiniAction, type MiniState } from "@/lib/minigame";
import { GENERAL_BY_ID } from "@/lib/roster";
import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";

const STAT_ROWS: { key: keyof Pick<MiniState, "dev" | "commerce" | "order" | "training">; label: string; color: string }[] = [
  { key: "dev", label: "개발", color: "bg-green-500" },
  { key: "commerce", label: "상업", color: "bg-amber-500" },
  { key: "order", label: "치안", color: "bg-blue-500" },
  { key: "training", label: "훈련", color: "bg-red-500" },
];

export default function Minigame() {
  const [state, setState] = useState<MiniState | null>(null);
  const [recruitOpen, setRecruitOpen] = useState(false);

  const act = (a: MiniAction) => {
    if (!state) return;
    const prevRecruited = state.recruited.length;
    const next = doAction(state, a);
    setState(next);
    setRecruitOpen(false);
    // 등용 성공 → 대전 카드 지급 (비동기, 실패해도 게임 진행에는 영향 없음)
    if (next.recruited.length > prevRecruited && firebaseEnabled) {
      grantCards(next.recruited.slice(prevRecruited)).catch(() => {});
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-950 via-amber-950/20 to-stone-950 text-white p-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">
            내 세계 — 난세 경영 <span className="text-white/40 text-sm">(클래식 삼국지 SLG)</span>
          </h1>
          <Link href="/" className="rounded-lg border border-white/20 px-4 py-1.5 text-sm hover:bg-white/10">
            대전으로
          </Link>
        </div>

        {!state ? (
          <Start onStart={() => setState(createMini())} />
        ) : state.finished ? (
          <Finish state={state} onRestart={() => setState(createMini())} />
        ) : (
          <div className="grid gap-3">
            {/* 상태 바 */}
            <div className="flex flex-wrap items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm">
              <span className="font-bold text-amber-300">
                {state.year}년 {state.quarter}분기 <span className="text-white/40">({state.quartersPlayed + 1}/{MINI.totalQuarters})</span>
              </span>
              <span>
                금 <b className="text-yellow-300">{state.gold}</b> · 병사 <b>{state.soldiers.toLocaleString()}</b> · 행동력{" "}
                <b className="text-green-300">{state.actionsLeft}</b>
              </span>
            </div>

            {/* 도시 수치 */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-white/60 text-sm mb-2">{state.cityName}성 — 3년 안에 이 땅을 일으켜라</p>
              <div className="grid gap-1.5">
                {STAT_ROWS.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-white/60">{label}</span>
                    <div className="flex-1 h-3 rounded bg-white/10 overflow-hidden">
                      <div className={`h-full ${color} transition-all`} style={{ width: `${state[key]}%` }} />
                    </div>
                    <span className="w-8 text-right">{state[key]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 휘하 장수 */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-white/50 text-xs mb-2">휘하 장수 {state.generals.length}명</p>
              <div className="flex gap-2 flex-wrap">
                {state.generals.map((id) => (
                  <MiniGeneral key={id} id={id} />
                ))}
              </div>
            </div>

            {/* 커맨드 */}
            <div className="grid grid-cols-3 gap-2">
              <Cmd label="개발" cost={MINI.costDev} onClick={() => act("dev")} state={state} />
              <Cmd label="상업" cost={MINI.costCommerce} onClick={() => act("commerce")} state={state} />
              <Cmd label="치안" cost={MINI.costOrder} onClick={() => act("order")} state={state} />
              <Cmd label="훈련" cost={MINI.costTrain} onClick={() => act("train")} state={state} />
              <Cmd label="수색" cost={0} onClick={() => act("search")} state={state} />
              <Cmd label="등용" cost={MINI.costRecruit} onClick={() => setRecruitOpen(!recruitOpen)} state={state} />
            </div>

            {/* 등용 후보 */}
            {recruitOpen && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-amber-500/30 bg-black/40 p-3">
                <p className="text-amber-300 text-xs mb-2">재야의 인재 — 등용 시도 (금 {MINI.costRecruit})</p>
                {state.candidates.length === 0 ? (
                  <p className="text-white/40 text-sm">알려진 인재가 없다. 수색으로 소문을 모아보자.</p>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {state.candidates.map((id) => (
                      <button key={id} onClick={() => act({ recruit: id })} className="hover:scale-105 transition-transform">
                        <MiniGeneral id={id} />
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* 로그 */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs space-y-1 max-h-44 overflow-y-auto">
              {[...state.log].reverse().map((l, i) => (
                <p key={i} className={i === 0 ? "text-white" : "text-white/40"}>
                  {l}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function MiniGeneral({ id }: { id: string }) {
  const gen = GENERAL_BY_ID[id];
  if (!gen) return null;
  return (
    <div className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs">
      <p className="font-bold">{gen.name}</p>
      <p className="text-white/50 text-[10px]">
        무{gen.base.combat} 지{gen.base.intellect} 정{gen.base.politics} 통{gen.base.leadership}
      </p>
    </div>
  );
}

function Cmd({ label, cost, onClick, state }: { label: string; cost: number; onClick: () => void; state: MiniState }) {
  const disabled = state.actionsLeft <= 0 || state.gold < cost;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-amber-600/40 bg-amber-900/20 py-3 font-bold hover:bg-amber-700/40 disabled:opacity-30 transition-colors"
    >
      {label}
      <span className="block text-[10px] font-normal text-white/40">{cost > 0 ? `금 ${cost}` : "무료"}</span>
    </button>
  );
}

function Start({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-white/10 bg-black/30 p-10 text-center">
      <p className="text-amber-400/80 tracking-[0.4em] text-sm">內 政</p>
      <h2 className="text-3xl font-bold">작은 성에서 시작하는 3년</h2>
      <p className="text-white/60 text-sm leading-relaxed max-w-md">
        분기마다 2번의 행동으로 개발·상업·치안·훈련을 다지고, 수색으로 인재의 소문을 모아 등용하세요.
        매년 연말에는 침공이 옵니다. <b className="text-amber-300">등용에 성공한 장수는 대전 카드로 지급됩니다.</b>
      </p>
      <button onClick={onStart} className="rounded-lg bg-amber-600 px-12 py-3 text-lg font-bold hover:bg-amber-500 transition-colors">
        시작하기
      </button>
    </div>
  );
}

function Finish({ state, onRestart }: { state: MiniState; onRestart: () => void }) {
  const rewardCards = useMemo(() => state.recruited.map((id) => createCard(id, 1)), [state.recruited]);
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-8 text-center">
      <h2 className="text-4xl font-bold text-amber-300">3년의 기록</h2>
      <p className="text-2xl">
        최종 평가 <b className="text-green-400">{state.score}점</b>
      </p>
      <p className="text-white/50 text-sm">
        개발 {state.dev} · 상업 {state.commerce} · 치안 {state.order} · 병사 {state.soldiers.toLocaleString()}
      </p>
      {state.recruited.length > 0 && (
        <>
          <p className="text-amber-400 text-sm">등용한 인재 {state.recruited.length}명이 대전 컬렉션에 합류했습니다</p>
          <div className="flex gap-2 flex-wrap justify-center">
            {rewardCards.map((c) => (
              <GeneralCard key={c.cardId} card={c} small />
            ))}
          </div>
        </>
      )}
      <div className="flex gap-3 mt-2">
        <button onClick={onRestart} className="rounded-lg bg-amber-600 px-8 py-2.5 font-bold hover:bg-amber-500 transition-colors">
          다시 시작
        </button>
        <Link href="/" className="rounded-lg border border-white/20 px-8 py-2.5 font-bold hover:bg-white/10 transition-colors">
          대전으로
        </Link>
      </div>
    </div>
  );
}
