"use client";

import GeneralCard from "@/components/GeneralCard";
import { createCard, rollGrade, shuffle } from "@/lib/battle";
import { enhanceCards, fetchCollection, fetchRecord, saveMatchResult, type UserRecord } from "@/lib/collection";
import { INFO_FACTION_DETAIL_TURN, INFO_POWER_EVERY, INFO_ROLE_TURN, REWARD, TURNS } from "@/lib/constants";
import { AUTH_ERROR_KO, currentUser, ensureUser, firebaseEnabled, signInEmail, signOutUser, signUpEmail } from "@/lib/firebase";
import { createMatch, oppRemainingInfo, playTurn, type MatchState } from "@/lib/match";
import {
  buildPvpDeck,
  createRoom,
  hostResolveTurn,
  joinRoom,
  listenPick,
  listenRoom,
  submitPick,
  type PvpPickData,
  type PvpRoom,
  type PvpSide,
  type PvpTurnResult,
} from "@/lib/pvp";
import { CITIES, SCENARIOS } from "@/lib/roster";
import type { DuelResult } from "@/lib/types";
import { useRef } from "react";
import { GENERAL_BY_ID, ROSTER } from "@/lib/roster";
import type { CardInstance, Difficulty, Faction, TurnLog } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type Screen = "intro" | "sequence" | "battle" | "result" | "collection" | "pvp";

const DIFF_LABEL: Record<Difficulty, string> = { easy: "쉬움", normal: "보통", hard: "어려움" };

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

/* ─────────────── 인트로 ─────────────── */

function Intro({
  onStart,
  onCollection,
  onPvp,
}: {
  onStart: (d: Difficulty, shifts: number) => void;
  onCollection: () => void;
  onPvp: () => void;
}) {
  const [record, setRecord] = useState<UserRecord | null>(null);
  const [shifts, setShifts] = useState(0);
  useEffect(() => {
    if (firebaseEnabled) fetchRecord().then(setRecord).catch(() => {});
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 p-6 overflow-hidden">
      {/* 배경: 대전장 파노라마 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/bg/main.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950/70 via-transparent to-stone-950/90" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative text-center">
        <p className="text-amber-400/90 tracking-[0.5em] text-sm mb-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">三國志</p>
        <h1 className="text-6xl font-bold mb-3 drop-shadow-[0_3px_8px_rgba(0,0,0,0.95)] bg-gradient-to-b from-amber-100 via-white to-amber-300 bg-clip-text text-transparent">
          삼국지 카드 대전
        </h1>
        <p className="text-white/70 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">같은 역사를 함께 플레이한다 — 30턴 정보전</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="relative flex flex-col items-center gap-3"
      >
        <div className="flex flex-col items-center gap-1">
          <p className="text-white/60 text-sm">국면 전환 — 판 중간에 역사·전장이 바뀌는 횟수</p>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setShifts(n)}
                className={`rounded-lg border px-5 py-1.5 text-sm font-bold transition-colors ${
                  shifts === n
                    ? "border-red-400 bg-red-900/60 text-red-200"
                    : "border-white/20 text-white/60 hover:bg-white/10"
                }`}
              >
                {n}회
              </button>
            ))}
          </div>
          <p className="text-white/30 text-xs">
            {shifts === 0 ? "안정 — 처음 국면으로 끝까지" : shifts === 3 ? "격변 — 무엇이 와도 버티는 덱이 유리" : "중간에 판이 갈아엎어집니다"}
          </p>
        </div>
        <p className="text-white/60 text-sm mt-2">AI 난이도를 선택하세요</p>
        <div className="flex gap-3">
          {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => onStart(d, shifts)}
              className="rounded-lg border border-amber-500/50 bg-amber-900/30 px-8 py-3 text-lg font-bold hover:bg-amber-700/50 transition-colors"
            >
              {DIFF_LABEL[d]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2 flex-wrap justify-center">
          <button
            onClick={onPvp}
            className="rounded-lg border border-red-500/40 bg-red-950/40 px-8 py-2 text-sm text-red-200 font-bold hover:bg-red-900/50 transition-colors"
          >
            ⚔ 친구 대결 (PvP)
          </button>
          <button
            onClick={onCollection}
            className="rounded-lg border border-white/20 px-8 py-2 text-sm text-white/70 hover:bg-white/10 transition-colors"
          >
            내 컬렉션
          </button>
          <a
            href="/minigame"
            className="rounded-lg border border-amber-500/30 px-8 py-2 text-sm text-amber-300/90 hover:bg-amber-900/30 transition-colors"
          >
            내 세계 (경영)
          </a>
        </div>
        {record && (
          <p className="text-white/40 text-xs">
            전적 {record.wins}승 {record.losses}패{record.draws > 0 && ` ${record.draws}무`}
          </p>
        )}
        <AuthBox />
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
      lines: [
        `나의 덱 — ${myFactions}`,
        `컬렉션 카드 ${match.ownedCount}장 + 용병 ${30 - match.ownedCount}장 출전`,
        "상대 덱 — 총 전투력·구성은 대전 중 점차 공개",
        match.phaseShifts > 0
          ? `⚡ 국면 전환 ${match.phaseShifts}회 — ${match.shiftTurns.join(", ")}턴에 역사·전장 재추첨`
          : "국면 전환 없음 — 이 국면으로 끝까지",
      ],
      color: "text-amber-400",
    },
  ];

  const cur = steps[step];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 p-6">
      <motion.div
        key={step}
        initial={{ opacity: 0, scale: 0.8, rotateX: 60 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0 }}
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
      <button
        onClick={() => (step < steps.length - 1 ? setStep(step + 1) : onDone())}
        className="rounded-lg bg-amber-600 px-10 py-3 text-lg font-bold hover:bg-amber-500 transition-colors"
      >
        {step < steps.length - 1 ? "다음" : "대전 시작"}
      </button>
    </div>
  );
}

/* ─────────────── 로그인 (마이페이지 계정) ─────────────── */

function AuthBox() {
  const [email, setEmail] = useState<string | null>(null); // 로그인된 이메일
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", pw: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firebaseEnabled) return;
    ensureUser().then(() => setEmail(currentUser()?.email ?? null)).catch(() => {});
  }, []);

  const doAuth = async (mode: "signup" | "login") => {
    if (busy || !form.email || form.pw.length < 6) {
      setMsg("이메일과 6자 이상 비밀번호를 입력하세요");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const user = mode === "signup" ? await signUpEmail(form.email, form.pw) : await signInEmail(form.email, form.pw);
      setEmail(user.email);
      setOpen(false);
      setMsg(null);
      window.location.reload(); // 전적·컬렉션 재로드
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setMsg(AUTH_ERROR_KO[code] ?? `실패: ${code}`);
    }
    setBusy(false);
  };

  if (!firebaseEnabled) return null;

  if (email) {
    return (
      <p className="text-white/40 text-xs flex items-center gap-2">
        {email}
        <button
          onClick={async () => {
            await signOutUser();
            window.location.reload();
          }}
          className="underline hover:text-white"
        >
          로그아웃
        </button>
      </p>
    );
  }

  return (
    <div className="text-xs text-center">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-white/40 underline hover:text-white">
          게스트로 플레이 중 — 계정 만들면 다른 기기에서도 이어집니다
        </button>
      ) : (
        <div className="flex flex-col gap-1.5 items-center rounded-lg border border-white/15 bg-black/40 p-3">
          <input
            type="email"
            placeholder="이메일"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded bg-white/10 px-3 py-1.5 w-56 outline-none focus:bg-white/15"
          />
          <input
            type="password"
            placeholder="비밀번호 (6자 이상)"
            value={form.pw}
            onChange={(e) => setForm({ ...form, pw: e.target.value })}
            className="rounded bg-white/10 px-3 py-1.5 w-56 outline-none focus:bg-white/15"
          />
          <div className="flex gap-2">
            <button onClick={() => doAuth("signup")} disabled={busy} className="rounded bg-amber-700 px-4 py-1.5 font-bold hover:bg-amber-600 disabled:opacity-40">
              가입 (현재 컬렉션 유지)
            </button>
            <button onClick={() => doAuth("login")} disabled={busy} className="rounded bg-white/10 px-4 py-1.5 font-bold hover:bg-white/20 disabled:opacity-40">
              로그인
            </button>
            <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white">
              닫기
            </button>
          </div>
          {msg && <p className="text-red-300">{msg}</p>}
        </div>
      )}
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

      {/* 내 손패 */}
      <div className="flex flex-col items-center gap-3 pb-4">
        <div className="flex gap-2 justify-center flex-wrap">
          {match.myHand.map((c) => (
            <div key={c.cardId} className="relative">
              <GeneralCard
                card={c}
                selected={selected === c.cardId || supportSel === c.cardId}
                dimmed={!!reveal}
                onClick={() => clickCard(c)}
              />
              {supportSel === c.cardId && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-blue-500 px-2 py-0.5 text-[10px] font-bold">
                  모사
                </span>
              )}
            </div>
          ))}
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
        {bd.weighted} × {bd.eraLabel} {bd.eraMult} × {bd.homeLabel} {bd.homeMult}
        {bd.cityBonus > 0 && ` + 도시 ${bd.cityBonus}`}
        {bd.supportBonus != null && ` + 모사 ${bd.supportBonus}`}
        {bd.traitNote && <span className="text-amber-300"> ⚡{bd.traitNote}</span>}
      </p>
    </div>
  );
}

/* ─────────────── PvP (친구 대결) ─────────────── */

function Pvp({ joinId, onBack }: { joinId: string | null; onBack: () => void }) {
  const [phase, setPhase] = useState<"init" | "waiting" | "playing" | "done" | "error">("init");
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
          const id = await createRoom(myDeck);
          setRoomId(id);
          setSide("host");
          setPhase("waiting");
        }
      } catch {
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      remainCards.reduce((x, c) => x + (c.stats.combat * 0.5 + c.stats.leadership * 0.3 + c.stats.intellect * 0.2), 0)
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
          {hand.map((c) => (
            <div key={c.cardId} className="relative">
              <GeneralCard
                card={c}
                selected={selected === c.cardId || supportSel === c.cardId}
                dimmed={submitted || !!reveal}
                onClick={() => clickCard(c)}
              />
              {supportSel === c.cardId && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-blue-500 px-2 py-0.5 text-[10px] font-bold">모사</span>
              )}
            </div>
          ))}
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
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
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
      setFillMode((localStorage.getItem("deck_fillmode") as "random" | "tiered") ?? "random");
    } catch {}
  }, []);

  const togglePin = (cardId: string) => {
    const next = pinned.includes(cardId)
      ? pinned.filter((id) => id !== cardId)
      : pinned.length < 30
        ? [...pinned, cardId]
        : pinned;
    setPinned(next);
    localStorage.setItem("deck_pinned", JSON.stringify(next));
  };

  const changeFill = (m: "random" | "tiered") => {
    setFillMode(m);
    localStorage.setItem("deck_fillmode", m);
  };

  // 같은 장수 + 같은 등급끼리 묶기 (강화 재료 표시)
  const groups = useMemo(() => {
    if (!cards) return [];
    const map = new Map<string, CardInstance[]>();
    for (const c of cards) {
      const key = `${c.generalId}:${c.grade}`;
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return [...map.values()];
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
              덱 편성 — 지정 {pinned.length}/30 <span className="text-white/40 font-normal">(카드를 눌러 출전 지정, 나머지는 용병 충원)</span>
            </p>
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
              return (
                <div key={`${g[0].generalId}:${g[0].grade}`} className="relative flex flex-col items-center gap-1">
                  <div
                    className={`relative cursor-pointer ${pinnedInGroup > 0 ? "ring-2 ring-amber-400 rounded-xl" : ""}`}
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
                  </div>
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
