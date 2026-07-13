"use client";

import { fetchRecord, type UserRecord } from "@/lib/collection";
import { AUTH_ERROR_KO, currentUser, ensureUser, firebaseEnabled, signInEmail, signInGoogle, signOutUser, signUpEmail } from "@/lib/firebase";
import { type Difficulty } from "@/lib/types";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { DIFF_LABEL } from "./common";

export default function Intro({
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
  const [confirm, setConfirm] = useState<Difficulty | null>(null);
  useEffect(() => {
    if (firebaseEnabled) fetchRecord().then(setRecord).catch(() => {});
  }, []);

  // 확인 모달용 출전 덱 요약 (덱 편성 화면에서 지정한 카드)
  const deckSummary = () => {
    let pinnedCount = 0;
    let fillMode: "random" | "tiered" = "random";
    try {
      pinnedCount = (JSON.parse(localStorage.getItem("deck_pinned") ?? "[]") as string[]).length;
      fillMode = (localStorage.getItem("deck_fillmode") as "random" | "tiered") ?? "random";
    } catch {}
    return { pinnedCount, fillMode };
  };

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
              onClick={() => setConfirm(d)}
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
            <span className="text-amber-300 ml-2">· {record.points ?? 0} 포인트</span>
          </p>
        )}
        <AuthBox />
      </motion.div>

      {confirm && (() => {
        const { pinnedCount, fillMode } = deckSummary();
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
            onClick={() => setConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-amber-500/40 bg-stone-900 p-6 text-center shadow-2xl"
            >
              <p className="text-amber-300 font-bold text-xl mb-4">이대로 출진하시겠습니까?</p>
              <div className="mb-5 flex flex-col gap-2 text-sm">
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-white/50">AI 난이도</span>
                  <span className="font-bold">{DIFF_LABEL[confirm]}</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-white/50">국면 전환</span>
                  <span className="font-bold">{shifts === 0 ? "없음 (안정)" : `${shifts}회`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">출전 덱</span>
                  <span className="font-bold">
                    {pinnedCount > 0 ? `지정 ${pinnedCount}장` : "자동 편성"}
                    {pinnedCount < 30 && (
                      <span className="text-white/40 font-normal">
                        {" "}+ 용병 {30 - pinnedCount}장 ({fillMode === "random" ? "랜덤" : "권역 균형"})
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirm(null)}
                  className="flex-1 rounded-lg border border-white/20 py-2.5 text-sm font-bold text-white/70 hover:bg-white/10"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    const d = confirm;
                    setConfirm(null);
                    onStart(d, shifts);
                  }}
                  className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-bold hover:bg-amber-500"
                >
                  대전 시작
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </div>
  );
}

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

  const doGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await signInGoogle();
      window.location.reload();
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setMsg(AUTH_ERROR_KO[code] ?? `실패: ${code}`);
      setBusy(false);
    }
  };

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
          <button
            onClick={doGoogle}
            disabled={busy}
            className="flex items-center gap-2 rounded bg-white px-4 py-2 w-56 justify-center font-bold text-stone-800 hover:bg-gray-100 disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 35.3 44 30.1 44 24c0-1.3-.1-2.6-.4-3.9z" />
            </svg>
            Google로 계속하기
          </button>
          <p className="text-white/30">— 또는 이메일로 —</p>
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
