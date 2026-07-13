"use client";

import GeneralCard from "@/components/GeneralCard";
import { calcPower } from "@/lib/battle";
import { INFO_FACTION_DETAIL_TURN, INFO_POWER_EVERY, INFO_ROLE_TURN, isCourtTurn, TURNS } from "@/lib/constants";
import { oppRemainingInfo, playTurn, type MatchState } from "@/lib/match";
import { type CardInstance, type TurnLog } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { factionRatio } from "./common";

export default function Battle({
  match,
  setMatch,
  onFinished,
}: {
  match: MatchState;
  setMatch: (m: MatchState) => void;
  onFinished: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [supportSel, setSupportSel] = useState<string | null>(null);
  const [reveal, setReveal] = useState<TurnLog | null>(null);
  const [flipped, setFlipped] = useState(false);

  const isStrategist = (c: CardInstance) => c.stats.intellect >= 85;

  const clickCard = (c: CardInstance) => {
    if (reveal) return;
    if (selected === c.cardId) {
      // 메인 해제 → 모사가 있으면 모사를 메인으로 승격
      setSelected(supportSel);
      setSupportSel(null);
    } else if (supportSel === c.cardId) {
      setSupportSel(null);
    } else if (selected && isStrategist(c)) {
      setSupportSel(c.cardId); // 모사로 지정 (2:2)
    } else {
      setSelected(c.cardId);
      setSupportSel(null);
    }
  };

  // 정보 공개 곡선: 5턴마다 갱신된 값만 표시
  const infoTurn = Math.floor((match.turn - 1) / INFO_POWER_EVERY) * INFO_POWER_EVERY;
  const oppInfo = useMemo(() => oppRemainingInfo(match), [match]);
  const showFactionDetail = match.turn > INFO_FACTION_DETAIL_TURN;
  const showRoles = match.turn > INFO_ROLE_TURN;
  const court = isCourtTurn(match.turn);
  // 위압당한 턴: 최강 카드 사용 불가
  const blockedCardId = useMemo(() => {
    if (match.overawedSide !== "me" || match.myHand.length <= 1) return null;
    const mode = court ? ("court" as const) : ("battle" as const);
    return match.myHand.reduce((a, b) =>
      calcPower(a, match.scenario, match.city, match.eraFloor, mode).total >=
      calcPower(b, match.scenario, match.city, match.eraFloor, mode).total
        ? a
        : b
    ).cardId;
  }, [match, court]);

  const commit = () => {
    if (!selected || reveal) return;
    const next = playTurn(match, selected, supportSel ?? undefined);
    const log = next.logs[next.logs.length - 1];
    setMatch(next);
    setSelected(null);
    setSupportSel(null);
    setReveal(log);
    setFlipped(false);
    setTimeout(() => setFlipped(true), 700);
  };

  const closeReveal = () => {
    setReveal(null);
    if (match.finished) onFinished();
  };

  return (
    <div className="flex min-h-screen flex-col p-4 max-w-5xl mx-auto">
      {/* 상단 정보 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm">
        <div className="flex gap-4 text-white/70 items-center">
          <span className="text-red-400">{match.scenario.name}</span>
          <span className="text-blue-400">{match.city.name}</span>
          {court && <span className="rounded bg-indigo-800/80 px-2 py-0.5 text-xs font-bold text-indigo-100">📜 조정 국면 — 정치·지략 판정</span>}
          {match.phaseShifts > 0 && (
            <span className="text-white/40 text-xs">
              ⚡ 전환 {match.shiftsDone}/{match.phaseShifts}
              {match.shiftsDone < match.phaseShifts && ` (다음 ${match.shiftTurns[match.shiftsDone]}턴)`}
            </span>
          )}
        </div>
        <div className="font-bold text-lg">
          <span className="text-green-400">{match.myScore}</span>
          <span className="text-white/40 mx-2">
            {Math.min(match.turn, TURNS)} / {TURNS} 턴
          </span>
          <span className="text-red-400">{match.oppScore}</span>
        </div>
        <div className="text-white/50 text-xs text-right">
          <p>
            상대 잔여 전투력{" "}
            {infoTurn >= INFO_POWER_EVERY ? (
              <b className="text-white/90">{oppInfo.total}</b>
            ) : (
              <span className="text-white/30">? (5턴부터 공개)</span>
            )}{" "}
            · 잔여 {oppInfo.count}장
          </p>
          <p>
            국가 상세{" "}
            {showFactionDetail
              ? factionRatio([...match.oppHand, ...match.oppDeck])
              : `${INFO_FACTION_DETAIL_TURN}턴 후 공개`}
            {showRoles && " · 장수/모사 공개됨"}
          </p>
        </div>
      </div>

      {/* 중앙 대결 영역 */}
      <div className="flex flex-1 items-center justify-center py-6">
        {reveal ? (
          <RevealPanel log={reveal} flipped={flipped} onNext={closeReveal} finished={match.finished} />
        ) : match.shiftNotice ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/50 bg-red-950/60 px-10 py-8 text-center"
          >
            <p className="text-red-400 tracking-[0.4em] text-sm">국 면 전 환</p>
            <p className="text-3xl font-bold">{match.shiftNotice.scenario.name}</p>
            <p className="text-blue-300 text-xl">새 전장 — {match.shiftNotice.city.name}</p>
            <p className="text-white/50 text-xs">모든 카드의 역사 배율이 재판정됩니다 (하한 ×0.7 완충)</p>
            <button
              onClick={() => setMatch({ ...match, shiftNotice: null })}
              className="mt-2 rounded-lg bg-red-700 px-8 py-2 font-bold hover:bg-red-600 transition-colors"
            >
              계속
            </button>
          </motion.div>
        ) : (
          <p className="text-white/30 text-lg">손패에서 카드를 골라 출진시키세요</p>
        )}
      </div>

      {/* 내 손패 (유효 전투력 = 전투50%+통솔30%+지략20% × 역사·홈, 이 판 기준 미리보기) */}
      <div className="flex flex-col items-center gap-3 pb-4">
        <div className="flex gap-2 justify-center flex-wrap">
          {match.myHand.map((c) => {
            const preview = calcPower(c, match.scenario, match.city, match.eraFloor, court ? "court" : "battle").total;
            const blocked = blockedCardId === c.cardId;
            return (
              <div key={c.cardId} className="relative flex flex-col items-center gap-0.5">
                <GeneralCard
                  card={c}
                  selected={selected === c.cardId || supportSel === c.cardId}
                  dimmed={!!reveal || blocked}
                  onClick={() => !blocked && clickCard(c)}
                />
                <span className={`rounded bg-black/60 px-2 py-0.5 text-[10px] ${court ? "text-indigo-200" : "text-amber-200"}`}>
                  {court ? "조정 전투력" : "이 판 전투력"} <b>{Math.round(preview)}</b>
                </span>
                {blocked && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold">
                    위압당함
                  </span>
                )}
                {supportSel === c.cardId && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-blue-500 px-2 py-0.5 text-[10px] font-bold">
                    모사
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-white/30 text-xs h-4">
          {selected && !supportSel && match.myHand.some((c) => c.cardId !== selected && isStrategist(c))
            ? "지략 85+ 카드를 추가로 누르면 2:2 (모사 보정, 카드 2장 소모)"
            : supportSel
              ? "2:2 출진 — 이겨도 1점, 카드는 2장 소모됩니다"
              : ""}
        </p>
        <button
          onClick={commit}
          disabled={!selected || !!reveal}
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

export function RevealPanel({
  log,
  flipped,
  onNext,
  finished,
}: {
  log: TurnLog;
  flipped: boolean;
  onNext: () => void;
  finished: boolean;
}) {
  // 일기토 합 진행 타이머 (합마다 카드 충돌 연출)
  const [duelStep, setDuelStep] = useState(0);
  const duelRounds = log.duel?.rounds.length ?? 0;
  useEffect(() => {
    if (!flipped || !log.duel) return;
    setDuelStep(0);
    const iv = setInterval(() => {
      setDuelStep((s) => {
        if (s >= duelRounds + 1) {
          clearInterval(iv);
          return s;
        }
        return s + 1;
      });
    }, 850);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, log]);

  const curRound = log.duel && duelStep >= 1 && duelStep <= duelRounds ? log.duel.rounds[duelStep - 1] : null;
  const duelDone = !log.duel || duelStep > duelRounds;
  const winnerLabel = log.duel
    ? log.winner === "me"
      ? "일기토 승리!"
      : "일기토 패배"
    : log.winner === "me"
      ? "승리!"
      : log.winner === "opp"
        ? "패배"
        : "무승부";
  const winnerColor = log.winner === "me" ? "text-green-400" : log.winner === "opp" ? "text-red-400" : "text-white/60";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-6 relative">
        {/* 내 카드 (+모사) */}
        <motion.div initial={{ x: -80, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <motion.div
            key={`me-${duelStep}`}
            animate={
              curRound
                ? curRound.winner === "me"
                  ? { x: [0, 44, 0] } // 승자: 돌진
                  : { x: [0, -10, 8, -6, 0], rotate: [0, -3, 2, 0] } // 패자: 피격 흔들림
                : {}
            }
            transition={{ duration: 0.55 }}
          >
            <div className="flex items-end gap-1.5">
              <div className={flipped && duelDone && log.winner === "me" ? "ring-4 ring-green-400 rounded-xl" : ""}>
                <GeneralCard card={log.myCard} />
              </div>
              {log.mySupport && <GeneralCard card={log.mySupport} small />}
            </div>
          </motion.div>
          <PowerLine label="나" bd={log.myPower} show={flipped} />
        </motion.div>

        <span className="text-3xl font-bold text-white/40 relative">
          VS
          {/* 합 충돌 플래시 */}
          {curRound && (
            <motion.span
              key={`spark-${duelStep}`}
              initial={{ opacity: 1, scale: 0.3 }}
              animate={{ opacity: 0, scale: 2.4 }}
              transition={{ duration: 0.5 }}
              className="absolute -inset-6 rounded-full bg-amber-400/60 blur-sm pointer-events-none"
            />
          )}
        </span>

        {/* 상대 카드 (뒤집힘 연출) */}
        <motion.div initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} style={{ perspective: 800 }}>
          <motion.div
            animate={{ rotateY: flipped ? 0 : 180 }}
            transition={{ duration: 0.5 }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {flipped ? (
              <motion.div
                key={`op-${duelStep}`}
                animate={
                  curRound
                    ? curRound.winner === "opp"
                      ? { x: [0, -44, 0] }
                      : { x: [0, 10, -8, 6, 0], rotate: [0, 3, -2, 0] }
                    : {}
                }
                transition={{ duration: 0.55 }}
              >
                <div className="flex items-end gap-1.5">
                  <div className={duelDone && log.winner === "opp" ? "ring-4 ring-red-400 rounded-xl" : ""}>
                    <GeneralCard card={log.oppCard} />
                  </div>
                  {log.oppSupport && <GeneralCard card={log.oppSupport} small />}
                </div>
              </motion.div>
            ) : (
              <div className="w-40 h-[15rem] rounded-xl border-2 border-white/20 bg-gradient-to-b from-stone-800 to-stone-900 flex items-center justify-center">
                <span className="text-white/20 text-5xl font-serif">戰</span>
              </div>
            )}
          </motion.div>
          <PowerLine label="상대" bd={log.oppPower} show={flipped} />
        </motion.div>
      </div>

      <AnimatePresence>
        {flipped && log.duel && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-1 rounded-xl border border-amber-500/40 bg-black/50 px-6 py-3"
          >
            <p className="text-amber-400 font-bold tracking-[0.3em]">
              {log.duel.isRival ? "숙명의 일기토!" : "일기토 발동!"}
            </p>
            {log.duel.rounds.slice(0, duelStep).map((r) => (
              <motion.p
                key={r.n}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                className={`text-sm ${r.winner === "me" ? "text-green-300" : "text-red-300"}`}
              >
                {r.n}합 — {r.winner === "me" ? "나" : "상대"}의 {r.event}
              </motion.p>
            ))}
            {duelDone && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white/40 text-[10px]">
                반전 확률 {Math.round(log.duel.upsetP * 100)}%
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flipped && duelDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-2"
          >
            <p className={`text-3xl font-bold ${winnerColor}`}>
              {winnerLabel}
              {log.duel && log.winner !== "draw" && <span className="text-lg ml-2">+2점</span>}
            </p>
            <button
              onClick={onNext}
              className="rounded-lg bg-amber-600 px-10 py-2 font-bold hover:bg-amber-500 transition-colors"
            >
              {finished ? "결과 보기" : "다음 턴"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PowerLine({ label, bd, show }: { label: string; bd: TurnLog["myPower"]; show: boolean }) {
  if (!show) return <div className="h-10" />;
  return (
    <div className="mt-2 text-center text-xs text-white/60 h-10">
      <p>
        {label} <b className="text-white text-base">{bd.total}</b>
      </p>
      <p className="text-[10px]">
        {bd.court && <span className="text-indigo-300">📜조정 </span>}
        {bd.weighted} × {bd.eraLabel} {bd.eraMult} × {bd.homeLabel} {bd.homeMult}
        {bd.cityBonus > 0 && ` + 도시 ${bd.cityBonus}`}
        {bd.supportBonus != null && ` + 모사 ${bd.supportBonus}`}
        {bd.traitNote && <span className="text-amber-300"> ⚡{bd.traitNote}</span>}
      </p>
    </div>
  );
}
