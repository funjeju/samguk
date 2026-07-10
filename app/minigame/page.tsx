"use client";

import { grantCards } from "@/lib/collection";
import { firebaseEnabled } from "@/lib/firebase";
import { GENERAL_BY_ID } from "@/lib/roster";
import { endMonth, executeCommand, factionCities, freeOfficersIn, officersIn, processCaptive } from "@/lib/rtk2/engine";
import { SCENARIO_DEFS } from "@/lib/rtk2/scenarios";
import { createGame } from "@/lib/rtk2/setup";
import type { Command, GameState, Officer } from "@/lib/rtk2/types";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const SAVE_KEY = "rtk2_save";

export default function Rtk2Page() {
  const [game, setGame] = useState<GameState | null>(null);
  const [scenario, setScenario] = useState<number | null>(null);
  const [hasSave, setHasSave] = useState(false);

  useEffect(() => {
    setHasSave(!!localStorage.getItem(SAVE_KEY));
  }, []);

  const save = (g: GameState) => {
    setGame(g);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(g));
    } catch {}
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-950 via-amber-950/10 to-stone-950 text-white">
      <div className="max-w-6xl mx-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">
            삼국지Ⅱ 재구성 <span className="text-white/40 text-xs">중국 41개 주 통일</span>
          </h1>
          <Link href="/" className="rounded border border-white/20 px-3 py-1 text-xs hover:bg-white/10">
            카드 대전으로
          </Link>
        </div>
        {!game ? (
          scenario === null ? (
            <ScenarioSelect
              onPick={setScenario}
              hasSave={hasSave}
              onLoad={() => {
                const raw = localStorage.getItem(SAVE_KEY);
                if (raw) setGame(JSON.parse(raw));
              }}
            />
          ) : (
            <RulerSelect
              scenarioId={scenario}
              onBack={() => setScenario(null)}
              onPick={(ruler) => save(createGame(scenario, ruler))}
            />
          )
        ) : game.finished ? (
          <Finished
            game={game}
            onRestart={() => {
              localStorage.removeItem(SAVE_KEY);
              setGame(null);
              setScenario(null);
              setHasSave(false);
            }}
          />
        ) : (
          <Board game={game} setGame={save} />
        )}
      </div>
    </main>
  );
}

/* ─── 시나리오/군주 선택 ─── */

function ScenarioSelect({ onPick, hasSave, onLoad }: { onPick: (n: number) => void; hasSave: boolean; onLoad: () => void }) {
  return (
    <div className="grid gap-3">
      {hasSave && (
        <button onClick={onLoad} className="rounded-lg bg-green-700 py-3 font-bold hover:bg-green-600">
          이어하기 (저장된 천하)
        </button>
      )}
      <p className="text-white/50 text-sm">시나리오를 선택하세요 — 원작 6개 시나리오, 군주·영토 배치 재현</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {SCENARIO_DEFS.map((sc) => (
          <button
            key={sc.id}
            onClick={() => onPick(sc.id)}
            className="rounded-xl border border-amber-600/30 bg-black/30 p-4 text-left hover:bg-amber-900/30 transition-colors"
          >
            <p className="text-amber-300 font-bold">
              {sc.id}. {sc.name} <span className="text-white/40 font-normal">({sc.year}년)</span>
            </p>
            <p className="text-white/50 text-xs mt-1">{sc.desc}</p>
            <p className="text-white/40 text-xs mt-1">군주 {sc.rulers.length}명</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function RulerSelect({ scenarioId, onBack, onPick }: { scenarioId: number; onBack: () => void; onPick: (name: string) => void }) {
  const sc = SCENARIO_DEFS.find((s) => s.id === scenarioId)!;
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded border border-white/20 px-3 py-1 text-xs hover:bg-white/10">
          ← 시나리오
        </button>
        <p className="text-amber-300 font-bold">
          {sc.name} ({sc.year}년) — 군주 선택
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {sc.rulers
          .filter((r) => r.playable)
          .map((r) => (
            <button
              key={r.name}
              onClick={() => onPick(r.name)}
              className="rounded-xl border border-white/15 bg-black/30 p-3 hover:bg-amber-900/40 transition-colors"
            >
              <p className="font-bold text-lg">{r.name}</p>
              <p className="text-white/40 text-xs">영지 {r.cities.length}개 — {r.cities.join(", ")}국</p>
            </button>
          ))}
      </div>
    </div>
  );
}

/* ─── 메인 보드 ─── */

function Board({ game, setGame }: { game: GameState; setGame: (g: GameState) => void }) {
  const [selCity, setSelCity] = useState<number | null>(null);
  const [menu, setMenu] = useState<string | null>(null);

  const myFaction = game.factions[game.playerFactionId];
  const city = selCity !== null ? game.cities[selCity] : null;
  const isMine = city?.factionId === game.playerFactionId;
  const myOfficers = city ? officersIn(game, city.id, game.playerFactionId) : [];
  const idle = myOfficers.filter((o) => !o.acted && o.wounded === 0);

  const runCmd = (cmd: Command) => {
    if (!city) return;
    const { state, recruited } = executeCommand(game, city.id, cmd);
    setGame(state);
    setMenu(null);
    // 등용 성공 → 카드 대전 컬렉션에 지급 (미니게임↔대전 연결)
    if (recruited && firebaseEnabled) {
      const name = state.officers[recruited]?.name;
      if (name && GENERAL_BY_ID[name]) grantCards([name]).catch(() => {});
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-3">
      <div>
        {/* 상태 바 */}
        <div className="flex flex-wrap items-center justify-between rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm mb-2">
          <span className="font-bold text-amber-300">
            {game.year}년 {game.month}월 — {myFaction.name}군
          </span>
          <span className="text-white/60 text-xs">
            영지 {factionCities(game, game.playerFactionId).length}/41 · 신뢰도 {myFaction.trust}
          </span>
          <button
            onClick={() => setGame(endMonth(game))}
            className="rounded bg-red-700 px-4 py-1 text-sm font-bold hover:bg-red-600"
          >
            다음 달 ▶
          </button>
        </div>

        <ChinaMap game={game} selected={selCity} onSelect={(id) => { setSelCity(id); setMenu(null); }} />

        {/* 로그 */}
        <div className="mt-2 rounded-lg border border-white/10 bg-black/40 p-2 text-[11px] h-32 overflow-y-auto space-y-0.5">
          {[...game.log].reverse().map((l, i) => (
            <p key={i} className={i === 0 ? "text-white" : "text-white/45"}>{l}</p>
          ))}
        </div>
      </div>

      {/* 도시 패널 */}
      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
        {!city ? (
          <p className="text-white/40 text-xs">지도에서 주(州)를 선택하세요. 숫자는 국번호, 색은 세력입니다.</p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <p className="font-bold text-lg">
                {city.id}. {city.name}
                <span className="text-white/40 text-xs ml-1">{game.factions[city.factionId ?? -1]?.name ?? "공백지"}</span>
              </p>
              {isMine && <span className="text-green-400 text-xs">아군 · 행동 가능 {idle.length}명</span>}
            </div>
            <div className="grid grid-cols-3 gap-1 my-2 text-xs">
              <Stat label="금" v={city.gold} />
              <Stat label="쌀" v={city.rice} />
              <Stat label="인구" v={city.population} />
              <Stat label="토지" v={city.land} />
              <Stat label="치수" v={city.flood} />
              <Stat label="민충" v={city.peace} />
              <Stat label="쌀시세" v={city.ricePrice} />
              <Stat label="무기" v={city.weapons} />
              <Stat label="말" v={city.horses} />
            </div>

            {/* 주둔 장수 */}
            <p className="text-white/50 text-xs mb-1">주둔 장수 {city.factionId !== null ? officersIn(game, city.id, city.factionId).length : 0}명</p>
            <div className="max-h-36 overflow-y-auto space-y-0.5 mb-2">
              {city.factionId !== null &&
                officersIn(game, city.id, city.factionId).map((o) => (
                  <p key={o.id} className={`text-[11px] ${o.acted ? "text-white/30" : "text-white/80"}`}>
                    {o.isRuler && "👑"}{o.name} — 지{o.int} 무{o.war} 매{o.chr} · 충{o.loyalty} · 병{o.soldiers} · 훈{o.trained}
                    {o.wounded > 0 && " 🤕"}
                    {o.acted && " (완)"}
                  </p>
                ))}
            </div>

            {isMine && idle.length > 0 && (
              <CommandMenu game={game} cityId={city.id} idle={idle} menu={menu} setMenu={setMenu} runCmd={runCmd} />
            )}
          </>
        )}
      </div>

      {/* 전투 보고 / 포로 처리 */}
      {game.pendingBattle && <BattleModal game={game} setGame={setGame} />}
      {!game.pendingBattle && game.pendingCaptives.length > 0 && <CaptiveModal game={game} setGame={setGame} />}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <p className="rounded bg-white/5 px-1.5 py-0.5">
      <span className="text-white/40">{label}</span> <b>{v.toLocaleString()}</b>
    </p>
  );
}

/* ─── 지도 ─── */

function ChinaMap({ game, selected, onSelect }: { game: GameState; selected: number | null; onSelect: (id: number) => void }) {
  const cities = Object.values(game.cities);
  return (
    <svg viewBox="0 0 100 104" className="w-full rounded-xl border border-white/10 bg-gradient-to-b from-stone-900 to-stone-950">
      {/* 인접선 */}
      {cities.flatMap((c) =>
        c.neighbors
          .filter((n) => n > c.id)
          .map((n) => {
            const t = game.cities[n];
            return <line key={`${c.id}-${n}`} x1={c.x} y1={c.y} x2={t.x} y2={t.y} stroke="#ffffff18" strokeWidth="0.4" />;
          })
      )}
      {cities.map((c) => {
        const f = c.factionId !== null ? game.factions[c.factionId] : null;
        const isSel = selected === c.id;
        return (
          <g key={c.id} onClick={() => onSelect(c.id)} className="cursor-pointer">
            <circle
              cx={c.x}
              cy={c.y}
              r={isSel ? 3.4 : 2.6}
              fill={f?.color ?? "#44403c"}
              stroke={isSel ? "#fbbf24" : f?.isPlayer ? "#ffffff" : "#00000060"}
              strokeWidth={isSel ? 0.8 : f?.isPlayer ? 0.6 : 0.3}
            />
            <text x={c.x} y={c.y + 0.9} textAnchor="middle" fontSize="2.4" fill="#fff" fontWeight="bold">
              {c.id}
            </text>
            <text x={c.x} y={c.y + 5.4} textAnchor="middle" fontSize="2.2" fill="#ffffff90">
              {c.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ─── 커맨드 메뉴 ─── */

function CommandMenu({
  game,
  cityId,
  idle,
  menu,
  setMenu,
  runCmd,
}: {
  game: GameState;
  cityId: number;
  idle: Officer[];
  menu: string | null;
  setMenu: (m: string | null) => void;
  runCmd: (c: Command) => void;
}) {
  const city = game.cities[cityId];
  const bestInt = [...idle].sort((a, b) => b.int - a.int)[0];
  const bestChr = [...idle].sort((a, b) => b.chr - a.chr)[0];
  const bestWar = [...idle].sort((a, b) => b.war - a.war)[0];
  const free = freeOfficersIn(game, cityId).filter((o) => o.discovered);
  const mine = officersIn(game, cityId, game.playerFactionId);
  const [warTargets, setWarTargets] = useState<string[]>([]);

  const neighborsEnemy = city.neighbors.map((n) => game.cities[n]).filter((c) => c.factionId !== game.playerFactionId);
  const neighborsMineOrEmpty = city.neighbors
    .map((n) => game.cities[n])
    .filter((c) => c.factionId === game.playerFactionId || c.factionId === null);

  const Btn = ({ id, label }: { id: string; label: string }) => (
    <button
      onClick={() => setMenu(menu === id ? null : id)}
      className={`rounded px-2 py-1 text-[11px] font-bold border transition-colors ${
        menu === id ? "bg-amber-700 border-amber-500" : "border-white/15 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="border-t border-white/10 pt-2">
      <div className="flex flex-wrap gap-1 mb-2">
        <Btn id="dev" label="개간" />
        <Btn id="flood" label="치수" />
        <Btn id="give" label="시여" />
        <Btn id="trade" label="상인" />
        <Btn id="reward" label="포상" />
        <Btn id="search" label="수색" />
        <Btn id="recruit" label="등용" />
        <Btn id="draft" label="징병" />
        <Btn id="train" label="훈련" />
        <Btn id="move" label="이동" />
        <Btn id="war" label="전쟁" />
      </div>

      {menu === "dev" && (
        <MiniAction label={`개간 — ${bestInt.name}(지력 ${bestInt.int}), 금 200`} onGo={() => runCmd({ type: "develop", officerId: bestInt.id, gold: 200 })} disabled={city.gold < 200} />
      )}
      {menu === "flood" && (
        <MiniAction label={`치수 — ${bestInt.name}(지력 ${bestInt.int}), 금 200`} onGo={() => runCmd({ type: "flood", officerId: bestInt.id, gold: 200 })} disabled={city.gold < 200} />
      )}
      {menu === "give" && (
        <MiniAction label={`시여 — ${bestChr.name}(매력 ${bestChr.chr}), 쌀 1000`} onGo={() => runCmd({ type: "give", officerId: bestChr.id, rice: 1000 })} disabled={city.rice < 1000} />
      )}
      {menu === "search" && <MiniAction label={`수색 — ${bestChr.name}(매력 ${bestChr.chr})`} onGo={() => runCmd({ type: "search", officerId: bestChr.id })} />}
      {menu === "train" && <MiniAction label={`훈련 — ${bestWar.name}(무력 ${bestWar.war})`} onGo={() => runCmd({ type: "train", officerId: bestWar.id })} />}
      {menu === "draft" && (
        <MiniAction label={`징병 20부대(2000명) — ${bestWar.name}, 금 200·쌀 2000`} onGo={() => runCmd({ type: "conscript", officerId: bestWar.id, amount: 20 })} disabled={city.gold < 200 || city.rice < 2000} />
      )}
      {menu === "trade" && (
        <div className="flex gap-1 flex-wrap text-[11px]">
          <button className="rounded bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => runCmd({ type: "trade", officerId: bestChr.id, mode: "buyRice", amount: 500 })}>
            쌀 매입 (금 500)
          </button>
          <button className="rounded bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => runCmd({ type: "trade", officerId: bestChr.id, mode: "sellRice", amount: 2000 })}>
            쌀 매각 (2000)
          </button>
          <button className="rounded bg-white/10 px-2 py-1 hover:bg-white/20" onClick={() => runCmd({ type: "trade", officerId: bestChr.id, mode: "buyWeapon", amount: 300 })}>
            무기 300
          </button>
          <p className="w-full text-white/40">시세 {city.ricePrice} — 높을 때 사고 낮을 때 파세요</p>
        </div>
      )}
      {menu === "reward" && (
        <div className="space-y-1 text-[11px] max-h-28 overflow-y-auto">
          {mine.filter((o) => !o.isRuler).sort((a, b) => a.loyalty - b.loyalty).map((o) => (
            <button key={o.id} className="block w-full text-left rounded bg-white/5 px-2 py-1 hover:bg-white/15" onClick={() => runCmd({ type: "reward", officerId: idle[0].id, targetId: o.id, gold: 50 })}>
              {o.name} (충성 {o.loyalty}) — 금 50 포상
            </button>
          ))}
        </div>
      )}
      {menu === "recruit" && (
        <div className="space-y-1 text-[11px]">
          {free.length === 0 ? (
            <p className="text-white/40">발견된 재야가 없습니다. 수색으로 찾아보세요.</p>
          ) : (
            free.map((o) => (
              <button key={o.id} className="block w-full text-left rounded bg-white/5 px-2 py-1 hover:bg-white/15" onClick={() => runCmd({ type: "recruit", officerId: bestChr.id, targetId: o.id })}>
                {o.name} — 지{o.int} 무{o.war} 매{o.chr} (사자: {bestChr.name})
              </button>
            ))
          )}
        </div>
      )}
      {menu === "move" && (
        <div className="space-y-1 text-[11px]">
          {neighborsMineOrEmpty.map((t) => (
            <button key={t.id} className="block w-full text-left rounded bg-white/5 px-2 py-1 hover:bg-white/15" onClick={() => runCmd({ type: "move", officerIds: idle.map((o) => o.id), toCity: t.id, gold: Math.floor(city.gold / 2), rice: Math.floor(city.rice / 2) })}>
              {t.id}. {t.name} {t.factionId === null && "(공백지 — 점령)"} — 대기 장수 전원 + 물자 절반
            </button>
          ))}
          {neighborsMineOrEmpty.length === 0 && <p className="text-white/40">이동 가능한 인접지가 없습니다</p>}
        </div>
      )}
      {menu === "war" && (
        <div className="space-y-1 text-[11px]">
          <p className="text-white/50">출병 장수 선택 (최대 5명):</p>
          {idle.filter((o) => o.soldiers > 0).map((o) => (
            <label key={o.id} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={warTargets.includes(o.id)}
                onChange={(e) =>
                  setWarTargets(e.target.checked ? [...warTargets, o.id].slice(0, 5) : warTargets.filter((x) => x !== o.id))
                }
              />
              {o.name} — 무{o.war} 병{o.soldiers} 훈{o.trained}
            </label>
          ))}
          {neighborsEnemy.map((t) => (
            <button
              key={t.id}
              disabled={warTargets.length === 0}
              className="block w-full text-left rounded bg-red-900/40 px-2 py-1 hover:bg-red-800/50 disabled:opacity-30"
              onClick={() => runCmd({ type: "war", officerIds: warTargets, toCity: t.id })}
            >
              ⚔ {t.id}. {t.name} ({game.factions[t.factionId ?? -1]?.name ?? "공백지"}) 침공
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniAction({ label, onGo, disabled }: { label: string; onGo: () => void; disabled?: boolean }) {
  return (
    <button onClick={onGo} disabled={disabled} className="w-full rounded bg-amber-800/50 px-2 py-1.5 text-[11px] text-left hover:bg-amber-700/50 disabled:opacity-30">
      ▶ {label}
    </button>
  );
}

/* ─── 전투 보고 / 포로 ─── */

function BattleModal({ game, setGame }: { game: GameState; setGame: (g: GameState) => void }) {
  const b = game.pendingBattle!;
  const atkName = game.factions[b.attacker]?.name;
  const defName = b.defender !== null ? game.factions[b.defender]?.name : "공백지";
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full rounded-2xl border border-red-500/40 bg-stone-900 p-5">
        <p className="text-red-400 font-bold tracking-widest text-sm mb-2">전 투 보 고</p>
        <p className="font-bold mb-2">
          {atkName}군 vs {defName}군 — {game.cities[b.cityId].name}
        </p>
        <div className="max-h-64 overflow-y-auto space-y-1 text-xs text-white/70 mb-2">
          {b.rounds.map((r, i) => (
            <motion.p key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.25 }}>
              {r}
            </motion.p>
          ))}
          {b.duel && (
            <div className="rounded bg-black/40 p-2 mt-1 border border-amber-500/30">
              {b.duel.log.map((l, i) => (
                <p key={i} className="text-amber-200/80">{l}</p>
              ))}
            </div>
          )}
        </div>
        <p className={`font-bold text-lg ${b.winner === "attacker" ? "text-red-400" : "text-blue-400"}`}>
          {b.winner === "attacker" ? `${atkName}군 승리 — ${game.cities[b.cityId].name} 함락!` : `${defName}군 방어 성공!`}
        </p>
        <button onClick={() => setGame({ ...game, pendingBattle: null })} className="mt-3 w-full rounded bg-amber-600 py-2 font-bold hover:bg-amber-500">
          확인
        </button>
      </motion.div>
    </div>
  );
}

function CaptiveModal({ game, setGame }: { game: GameState; setGame: (g: GameState) => void }) {
  const id = game.pendingCaptives[0];
  const o = game.officers[id];
  if (!o) {
    setGame({ ...game, pendingCaptives: game.pendingCaptives.slice(1) });
    return null;
  }
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm w-full rounded-2xl border border-white/20 bg-stone-900 p-5 text-center">
        <p className="text-amber-300 font-bold tracking-widest text-sm mb-2">포 로 처 리</p>
        <p className="text-xl font-bold">{o.name}</p>
        <p className="text-white/50 text-xs mb-3">
          지{o.int} 무{o.war} 매{o.chr} · 의리 {o.honor} {o.isRuler && "· 적 군주!"}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setGame(processCaptive(game, id, "recruit"))} disabled={o.isRuler} className="rounded bg-green-700 py-2 text-sm font-bold hover:bg-green-600 disabled:opacity-30">
            등용
          </button>
          <button onClick={() => setGame(processCaptive(game, id, "release"))} className="rounded bg-white/10 py-2 text-sm font-bold hover:bg-white/20">
            석방
          </button>
          <button onClick={() => setGame(processCaptive(game, id, "execute"))} className="rounded bg-red-800 py-2 text-sm font-bold hover:bg-red-700">
            참수
          </button>
        </div>
        {o.isRuler && <p className="text-white/40 text-[10px] mt-2">원작 규칙: 군주는 등용 불가 (석방/참수만)</p>}
      </motion.div>
    </div>
  );
}

/* ─── 종료 ─── */

function Finished({ game, onRestart }: { game: GameState; onRestart: () => void }) {
  const won = game.finished === "won";
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-10 text-center mt-10">
      <p className={`text-5xl font-bold ${won ? "text-amber-300" : "text-red-400"}`}>{won ? "천하 통일" : "패망"}</p>
      <p className="text-white/60">
        {game.year}년 {game.month}월 — {game.factions[game.playerFactionId].name}군
      </p>
      <button onClick={onRestart} className="rounded-lg bg-amber-600 px-10 py-3 font-bold hover:bg-amber-500">
        새로운 천하로
      </button>
    </div>
  );
}
