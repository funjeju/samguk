"use client";

import GeneralCard from "@/components/GeneralCard";
import { createCard, rollGrade, shuffle } from "@/lib/battle";
import { fetchCollection, fetchRecord, saveMatchResult, type UserRecord } from "@/lib/collection";
import { INFO_FACTION_DETAIL_TURN, INFO_POWER_EVERY, INFO_ROLE_TURN, REWARD, TURNS } from "@/lib/constants";
import { firebaseEnabled } from "@/lib/firebase";
import { createMatch, oppRemainingInfo, playTurn, type MatchState } from "@/lib/match";
import { GENERAL_BY_ID, ROSTER } from "@/lib/roster";
import type { CardInstance, Difficulty, Faction, TurnLog } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type Screen = "intro" | "sequence" | "battle" | "result" | "collection";

const DIFF_LABEL: Record<Difficulty, string> = { easy: "쉬움", normal: "보통", hard: "어려움" };

export default function Home() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [match, setMatch] = useState<MatchState | null>(null);

  const startMatch = (d: Difficulty) => {
    setMatch(createMatch(d));
    setScreen("sequence");
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-950 via-stone-900 to-stone-950 text-white">
      {screen === "intro" && <Intro onStart={startMatch} onCollection={() => setScreen("collection")} />}
      {screen === "collection" && <Collection onBack={() => setScreen("intro")} />}
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

/* ─────────────── 인트로 ─────────────── */

function Intro({ onStart, onCollection }: { onStart: (d: Difficulty) => void; onCollection: () => void }) {
  const [record, setRecord] = useState<UserRecord | null>(null);
  useEffect(() => {
    if (firebaseEnabled) fetchRecord().then(setRecord).catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <p className="text-amber-400/80 tracking-[0.5em] text-sm mb-2">三國志</p>
        <h1 className="text-5xl font-bold mb-3">삼국지 카드 대전</h1>
        <p className="text-white/50">같은 역사를 함께 플레이한다 — 30턴 정보전</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col items-center gap-3"
      >
        <p className="text-white/60 text-sm">AI 난이도를 선택하세요</p>
        <div className="flex gap-3">
          {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => onStart(d)}
              className="rounded-lg border border-amber-500/50 bg-amber-900/30 px-8 py-3 text-lg font-bold hover:bg-amber-700/50 transition-colors"
            >
              {DIFF_LABEL[d]}
            </button>
          ))}
        </div>
        <button
          onClick={onCollection}
          className="mt-2 rounded-lg border border-white/20 px-8 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors"
        >
          내 컬렉션
        </button>
        {record && (
          <p className="text-white/40 text-xs">
            전적 {record.wins}승 {record.losses}패{record.draws > 0 && ` ${record.draws}무`}
          </p>
        )}
      </motion.div>
    </div>
  );
}

/* ─────────────── 대전 시작 시퀀스 (역사·도시 발동) ─────────────── */

function StartSequence({ match, onDone }: { match: MatchState; onDone: () => void }) {
  const [step, setStep] = useState(0);

  const myFactions = factionRatio([...match.myHand, ...match.myDeck]);

  const steps = [
    {
      label: "역사 발동",
      title: match.scenario.name,
      lines: match.scenario.ruleTexts,
      color: "text-red-400",
    },
    {
      label: "전투 도시 발동",
      title: match.city.name,
      lines: [match.city.ruleText, `${match.city.name} 연고 장수는 홈 보너스 ×1.05`],
      color: "text-blue-400",
    },
    {
      label: "국가 구성 공개",
      title: "양측 구성 비율",
      lines: [`나의 덱 — ${myFactions}`, "상대 덱 — 총 전투력·구성은 대전 중 점차 공개"],
      color: "text-amber-400",
    },
  ];

  const cur = steps[step];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 p-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.8, rotateX: 60 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md rounded-2xl border border-white/20 bg-stone-900/90 p-8 text-center shadow-2xl"
        >
          <p className={`${cur.color} tracking-[0.4em] text-sm mb-4`}>{cur.label}</p>
          <h2 className="text-4xl font-bold mb-6">{cur.title}</h2>
          <div className="space-y-2">
            {cur.lines.map((l, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.25 }}
                className="text-white/70 text-sm"
              >
                {l}
              </motion.p>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
      <button
        onClick={() => (step < steps.length - 1 ? setStep(step + 1) : onDone())}
        className="rounded-lg bg-amber-600 px-10 py-3 text-lg font-bold hover:bg-amber-500 transition-colors"
      >
        {step < steps.length - 1 ? "다음" : "대전 시작"}
      </button>
    </div>
  );
}

function factionRatio(cards: CardInstance[]): string {
  const count: Record<string, number> = {};
  for (const c of cards) {
    const f = GENERAL_BY_ID[c.generalId].faction;
    count[f] = (count[f] ?? 0) + 1;
  }
  return (["위", "촉", "오", "군웅"] as Faction[])
    .filter((f) => count[f])
    .map((f) => `${f} ${count[f]}`)
    .join(" · ");
}

/* ─────────────── 대전 화면 ─────────────── */

function Battle({
  match,
  setMatch,
  onFinished,
}: {
  match: MatchState;
  setMatch: (m: MatchState) => void;
  onFinished: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [reveal, setReveal] = useState<TurnLog | null>(null);
  const [flipped, setFlipped] = useState(false);

  // 정보 공개 곡선: 5턴마다 갱신된 값만 표시
  const infoTurn = Math.floor((match.turn - 1) / INFO_POWER_EVERY) * INFO_POWER_EVERY;
  const oppInfo = useMemo(() => oppRemainingInfo(match), [match]);
  const showFactionDetail = match.turn > INFO_FACTION_DETAIL_TURN;
  const showRoles = match.turn > INFO_ROLE_TURN;

  const commit = () => {
    if (!selected || reveal) return;
    const next = playTurn(match, selected);
    const log = next.logs[next.logs.length - 1];
    setMatch(next);
    setSelected(null);
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
        <div className="flex gap-4 text-white/70">
          <span className="text-red-400">{match.scenario.name}</span>
          <span className="text-blue-400">{match.city.name}</span>
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
        ) : (
          <p className="text-white/30 text-lg">손패에서 카드를 골라 출진시키세요</p>
        )}
      </div>

      {/* 내 손패 */}
      <div className="flex flex-col items-center gap-3 pb-4">
        <div className="flex gap-2 justify-center flex-wrap">
          {match.myHand.map((c) => (
            <GeneralCard
              key={c.cardId}
              card={c}
              selected={selected === c.cardId}
              dimmed={!!reveal}
              onClick={() => !reveal && setSelected(c.cardId === selected ? null : c.cardId)}
            />
          ))}
        </div>
        <button
          onClick={commit}
          disabled={!selected || !!reveal}
          className="rounded-lg bg-red-700 px-12 py-2.5 text-lg font-bold hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          출진
        </button>
      </div>
    </div>
  );
}

function RevealPanel({
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
  const winnerLabel = log.winner === "me" ? "승리!" : log.winner === "opp" ? "패배" : "무승부";
  const winnerColor = log.winner === "me" ? "text-green-400" : log.winner === "opp" ? "text-red-400" : "text-white/60";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-6">
        {/* 내 카드 */}
        <motion.div initial={{ x: -80, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <div className={flipped && log.winner === "me" ? "ring-4 ring-green-400 rounded-xl" : ""}>
            <GeneralCard card={log.myCard} />
          </div>
          <PowerLine label="나" bd={log.myPower} show={flipped} />
        </motion.div>

        <span className="text-3xl font-bold text-white/40">VS</span>

        {/* 상대 카드 (뒤집힘 연출) */}
        <motion.div initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} style={{ perspective: 800 }}>
          <motion.div
            animate={{ rotateY: flipped ? 0 : 180 }}
            transition={{ duration: 0.5 }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {flipped ? (
              <div className={log.winner === "opp" ? "ring-4 ring-red-400 rounded-xl" : ""}>
                <GeneralCard card={log.oppCard} />
              </div>
            ) : (
              <div className="w-40 h-56 rounded-xl border-2 border-white/20 bg-gradient-to-b from-stone-800 to-stone-900 flex items-center justify-center">
                <span className="text-white/20 text-5xl font-serif">戰</span>
              </div>
            )}
          </motion.div>
          <PowerLine label="상대" bd={log.oppPower} show={flipped} />
        </motion.div>
      </div>

      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-2"
          >
            <p className={`text-3xl font-bold ${winnerColor}`}>{winnerLabel}</p>
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
        {bd.weighted} × {bd.eraLabel} {bd.eraMult} × {bd.homeLabel} {bd.homeMult}
        {bd.cityBonus > 0 && ` + 도시 ${bd.cityBonus}`}
      </p>
    </div>
  );
}

/* ─────────────── 결과 · 보상 ─────────────── */

function Result({ match, onRestart }: { match: MatchState; onRestart: () => void }) {
  const won = match.result === "win";
  const [rewards, setRewards] = useState<CardInstance[] | null>(null);
  const [saved, setSaved] = useState<"saving" | "saved" | "local">("saving");

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
      .then(({ rewards }) => {
        if (alive) {
          setRewards(rewards);
          setSaved("saved");
        }
      })
      .catch(localFallback);
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

/* ─────────────── 내 컬렉션 ─────────────── */

function Collection({ onBack }: { onBack: () => void }) {
  const [cards, setCards] = useState<CardInstance[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!firebaseEnabled) {
      setError(true);
      return;
    }
    fetchCollection().then(setCards).catch(() => setError(true));
  }, []);

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold">내 컬렉션</h2>
        <button
          onClick={onBack}
          className="rounded-lg border border-white/20 px-6 py-2 text-sm hover:bg-white/10 transition-colors"
        >
          돌아가기
        </button>
      </div>
      {error ? (
        <p className="text-white/40">오프라인 상태라 컬렉션을 불러올 수 없습니다.</p>
      ) : cards === null ? (
        <p className="text-white/40">불러오는 중...</p>
      ) : cards.length === 0 ? (
        <p className="text-white/40">아직 카드가 없습니다. 대전에서 승리해 카드를 모아보세요.</p>
      ) : (
        <>
          <p className="text-white/50 text-sm mb-4">총 {cards.length}장</p>
          <div className="flex gap-2 flex-wrap">
            {cards.map((c) => (
              <GeneralCard key={c.cardId} card={c} small />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
