"use client";

import { grantCards } from "@/lib/collection";
import { firebaseEnabled } from "@/lib/firebase";
import { GENERAL_BY_ID } from "@/lib/roster";
import { endMonth, executeCommand, factionCities, freeOfficersIn, officersIn, processCaptive } from "@/lib/rtk2/engine";
import { SCENARIO_DEFS } from "@/lib/rtk2/scenarios";
import { createGame } from "@/lib/rtk2/setup";
import type { Command, GameState, Officer } from "@/lib/rtk2/types";
import { CITY_BY_ID } from "@/lib/rtk2/cities";
import { Delaunay } from "d3-delaunay";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

// 중국 해안선 근사 폴리곤 (chinamap.webp 기준, viewBox 좌표) — 영역 클리핑용
const LAND_PATH =
  "M0,36 L70,36 L79,40 L93,42 L95,47 L83,50 L78,53 L84,56 L88,60 L80,63 L79,68 L83,72 L86,76 L84,82 L80,88 L74,94 L68,100 L64,106 L60,110 L56,113 L52,116 L53,122 L46,125 L42,118 L36,122 L30,130 L24,138 L18,146 L10,150 L0,150 Z";

const SEASONS = ["겨울", "겨울", "봄", "봄", "봄", "여름", "여름", "여름", "가을", "가을", "가을", "겨울", "겨울"];

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
    <main className="relative min-h-screen bg-gradient-to-b from-stone-950 via-amber-950/10 to-stone-950 text-white overflow-x-hidden">
      {/* 시작 화면(게임 미시작)에만 군략 지도 배경 */}
      {!game && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bg/rtk2.webp" alt="" className="fixed inset-0 h-full w-full object-cover" />
          <div className="fixed inset-0 bg-gradient-to-b from-stone-950/80 via-stone-950/55 to-stone-950/90" />
        </>
      )}
      <div className="relative max-w-6xl mx-auto p-3">
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
          <p className="text-white/40 text-xs">지도에서 국(國)을 선택하세요. 영역 색이 세력, 숫자가 국번호입니다.</p>
        ) : (
          <>
            {/* 원작식 헤더: 군주/신뢰도/태수/군사 + 초상 */}
            {(() => {
              const faction = city.factionId !== null ? game.factions[city.factionId] : null;
              const ruler = faction ? game.officers[faction.rulerId] : null;
              const stationed = city.factionId !== null ? officersIn(game, city.id, city.factionId) : [];
              const governor =
                stationed.find((o) => o.isRuler) ?? [...stationed].sort((a, b) => b.int + b.chr - (a.int + a.chr))[0];
              const advisor = [...stationed].sort((a, b) => b.int - a.int)[0];
              const freeCount = freeOfficersIn(game, city.id).filter((o) => o.discovered).length;
              return (
                <>
                  <div className="flex justify-between gap-2 rounded-lg bg-black/60 border border-amber-900/50 p-2 mb-2">
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold text-base text-white">
                        {city.id}. {city.name} <span className="text-white/40 text-[10px]">{CITY_BY_ID[city.id]?.province}</span>
                      </p>
                      <p>
                        <span className="text-red-400">군주:</span> {ruler?.name ?? "— (공백지)"}
                      </p>
                      <p>
                        <span className="text-yellow-300">신뢰도:</span> {faction?.trust ?? "—"}
                      </p>
                      <p>
                        <span className="text-cyan-300">태수:</span> {governor?.name ?? "—"}
                      </p>
                      <p>
                        <span className="text-fuchsia-300">군사:</span> {advisor?.name ?? "—"}
                      </p>
                    </div>
                    {ruler && <Portrait name={ruler.name} />}
                  </div>
                  <div className="grid grid-cols-3 gap-1 my-2 text-xs">
                    <Stat label="인구" v={city.population} />
                    <Stat label="병사" v={stationed.reduce((x, o) => x + o.soldiers, 0)} />
                    <Stat label="장수" v={stationed.length} />
                    <Stat label="금" v={city.gold} />
                    <Stat label="쌀" v={city.rice} />
                    <Stat label="세율" v={city.taxRate} />
                    <Stat label="민충" v={city.peace} />
                    <Stat label="토지" v={city.land} />
                    <Stat label="치수" v={city.flood} />
                    <Stat label="말" v={city.horses} />
                    <Stat label="무기" v={city.weapons} />
                    <Stat label="재야" v={freeCount} />
                  </div>
                </>
              );
            })()}

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

function Portrait({ name }: { name: string }) {
  const [idx, setIdx] = useState(0);
  const sources = [`/art/${name}.webp`, `/art/${name}.png`];
  return (
    <div className="w-16 h-20 rounded border-2 border-amber-700/60 bg-stone-800 overflow-hidden shrink-0 flex items-center justify-center">
      {idx < sources.length ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sources[idx]} alt="" className="h-full w-full object-cover" onError={() => setIdx(idx + 1)} />
      ) : (
        <span className="text-2xl font-serif text-amber-200/60">{name[0]}</span>
      )}
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

  // 보로노이 분할로 국경 생성 (원작처럼 영역이 세력색으로 칠해짐)
  // 팬텀 포인트: 사막·바다 쪽 셀 팽창 방지 (렌더링 제외)
  const cellPaths = useMemo(() => {
    const PHANTOM: [number, number][] = [
      // 북방 초원·사막
      [8, 38], [25, 40], [42, 38], [58, 40], [72, 37],
      [4, 48], [14, 44],
      // 서부 고원
      [4, 62], [4, 78], [4, 96], [8, 112], [2, 130],
      // 동·남 바다
      [97, 38], [98, 52], [93, 60], [92, 72], [90, 84], [84, 96],
      [76, 106], [68, 116], [58, 126], [64, 118], [46, 134], [30, 148], [55, 140],
      // 발해만
      [86, 47], [90, 53],
    ];
    const pts: [number, number][] = [...cities.map((c) => [c.x, c.y] as [number, number]), ...PHANTOM];
    const delaunay = Delaunay.from(pts);
    const vor = delaunay.voronoi([0, 36, 100, 150]);
    return cities.map((_, i) => vor.renderCell(i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg viewBox="0 36 100 114" className="w-full rounded-xl border border-white/10 bg-stone-950">
      <defs>
        <clipPath id="chinaLand">
          <path d={LAND_PATH} />
        </clipPath>
      </defs>
      {/* 중국 지형 배경 */}
      <image href="/bg/chinamap.webp" x="0" y="0" width="100" height="150" preserveAspectRatio="none" opacity="0.9" />
      {/* 세력 영역 (해안선 클리핑) */}
      <g clipPath="url(#chinaLand)">
        {cities.map((c, i) => {
          const f = c.factionId !== null ? game.factions[c.factionId] : null;
          const isSel = selected === c.id;
          return (
            <path
              key={c.id}
              d={cellPaths[i]}
              fill={f ? f.color : "#3a352c"}
              opacity={f ? 0.6 : 0.35}
              stroke={isSel ? "#fbbf24" : "#150f08"}
              strokeWidth={isSel ? 0.9 : 0.45}
              onClick={() => onSelect(c.id)}
              className="cursor-pointer hover:opacity-80"
            />
          );
        })}
      </g>
      {/* 국번호 + 지명 */}
      {cities.map((c) => {
        const f = c.factionId !== null ? game.factions[c.factionId] : null;
        return (
          <g key={c.id} onClick={() => onSelect(c.id)} className="cursor-pointer pointer-events-none">
            <text
              x={c.x}
              y={c.y + 0.8}
              textAnchor="middle"
              fontSize="2.6"
              fill="#ffffff"
              stroke="#000000cc"
              strokeWidth="0.4"
              paintOrder="stroke"
              fontWeight="bold"
            >
              {c.id}
            </text>
            <text
              x={c.x}
              y={c.y + 3.6}
              textAnchor="middle"
              fontSize="1.7"
              fill={f?.isPlayer ? "#fef3c7" : "#ffffffcc"}
              stroke="#000000aa"
              strokeWidth="0.25"
              paintOrder="stroke"
            >
              {c.name}
            </text>
          </g>
        );
      })}
      {/* 날짜 박스 (원작 스타일) */}
      <g>
        <rect x="1.5" y="38" width="22" height="9" rx="1" fill="#1c1410" stroke="#8b6d3f" strokeWidth="0.4" />
        <text x="12.5" y="41.8" textAnchor="middle" fontSize="2.6" fill="#ffe9c4" fontWeight="bold">
          {game.year}년 {game.month}월
        </text>
        <text x="12.5" y="45.2" textAnchor="middle" fontSize="2.2" fill="#c9a86a">
          {SEASONS[game.month]}
        </text>
      </g>
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
  const neighborsMine = city.neighbors.map((n) => game.cities[n]).filter((c) => c.factionId === game.playerFactionId);
  // 본국(군주 소재 도시)에서만 외교·계략 가능 (원작 규칙)
  const myFaction = game.factions[game.playerFactionId];
  const isCapital = game.officers[myFaction.rulerId]?.cityId === cityId;
  const otherFactions = game.factions.filter((f) => f.alive && f.id !== game.playerFactionId);
  const enemyOfficersNearby = neighborsEnemy
    .filter((c) => c.factionId !== null)
    .flatMap((c) => officersIn(game, c.id, c.factionId));

  // 원작 커맨드 번호 체계 (0~19)
  const NUMBERED: { n: number; label: string; id: string | null; capital?: boolean }[] = [
    { n: 0, label: "휴식", id: "rest" },
    { n: 1, label: "이동", id: "move" },
    { n: 2, label: "수송", id: "transport" },
    { n: 3, label: "전쟁", id: "war" },
    { n: 4, label: "군사", id: "mil" },
    { n: 5, label: "인사", id: "pers" },
    { n: 6, label: "외교", id: "diplo", capital: true },
    { n: 7, label: "계략", id: "plot", capital: true },
    { n: 8, label: "정보", id: null },
    { n: 9, label: "개간", id: "dev" },
    { n: 10, label: "치수", id: "flood" },
    { n: 11, label: "포상", id: "reward" },
    { n: 12, label: "선정", id: "give" },
    { n: 13, label: "상인", id: "trade" },
    { n: 14, label: "징수", id: "levy" },
    { n: 15, label: "세율", id: "tax" },
    { n: 16, label: "위임", id: null },
    { n: 17, label: "방랑", id: null },
    { n: 18, label: "특별", id: null },
    { n: 19, label: "기능", id: null },
  ];
  const ruler = game.officers[myFaction.rulerId];

  return (
    <div className="border-t border-amber-900/40 pt-2">
      <p className="text-[11px] text-amber-200/90 mb-1.5">
        {ruler?.name} 님, {cityId}국에 내릴 명령은? (0~19) — 행동 가능 {idle.length}명
      </p>
      <div className="grid grid-cols-5 gap-0.5 mb-2 text-[10px]">
        {NUMBERED.map((c) => {
          const disabled = c.id === null || (c.capital && !isCapital);
          const active = menu === c.id;
          return (
            <button
              key={c.n}
              disabled={disabled}
              title={c.capital && !isCapital ? "본국(군주 소재지)에서만 가능" : c.id === null ? "추후 구현" : ""}
              onClick={() => c.id && setMenu(menu === c.id ? null : c.id)}
              className={`rounded px-1 py-1 border font-bold transition-colors ${
                active
                  ? "bg-amber-700 border-amber-400"
                  : disabled
                    ? "border-white/5 text-white/20"
                    : "border-white/15 hover:bg-white/10"
              }`}
            >
              <span className="text-amber-400/80">{c.n}</span> {c.label}
            </button>
          );
        })}
      </div>
      {menu === "rest" && (
        <p className="text-[11px] text-white/40">명령 없이 달을 넘기려면 상단의 "다음 달 ▶"을 누르세요.</p>
      )}
      {menu === "mil" && (
        <div className="space-y-1">
          <MiniAction label={`징병 20부대(2000명) — ${bestWar.name}, 금 200·쌀 2000`} onGo={() => runCmd({ type: "conscript", officerId: bestWar.id, amount: 20 })} disabled={city.gold < 200 || city.rice < 2000} />
          <MiniAction label={`훈련 — ${bestWar.name}(무력 ${bestWar.war})`} onGo={() => runCmd({ type: "train", officerId: bestWar.id })} />
        </div>
      )}
      {menu === "pers" && (
        <div className="space-y-1">
          <MiniAction label={`수색 — ${bestChr.name}(매력 ${bestChr.chr})`} onGo={() => runCmd({ type: "search", officerId: bestChr.id })} />
          <div className="text-[11px]">
            {free.length === 0 ? (
              <p className="text-white/40">발견된 재야가 없습니다. 수색으로 찾아보세요.</p>
            ) : (
              free.map((o) => (
                <button key={o.id} className="block w-full text-left rounded bg-white/5 px-2 py-1 hover:bg-white/15" onClick={() => runCmd({ type: "recruit", officerId: bestChr.id, targetId: o.id })}>
                  등용: {o.name} — 지{o.int} 무{o.war} 매{o.chr}
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {menu === "levy" && (
        <MiniAction label={`임시징수 — 민충성·신뢰도 하락 (즉시 금·쌀 확보)`} onGo={() => runCmd({ type: "levy", officerId: idle[0].id })} />
      )}
      {menu === "tax" && (
        <div className="flex gap-1 text-[11px] items-center">
          <span className="text-white/50">세율 (현재 {city.taxRate}%):</span>
          {[20, 35, 50, 65, 80].map((r) => (
            <button key={r} className={`rounded px-2 py-1 border ${city.taxRate === r ? "border-amber-400 bg-amber-800/50" : "border-white/15 hover:bg-white/10"}`} onClick={() => runCmd({ type: "setTax", rate: r })}>
              {r}%
            </button>
          ))}
        </div>
      )}

      {menu === "dev" && (
        <MiniAction label={`개간 — ${bestInt.name}(지력 ${bestInt.int}), 금 200`} onGo={() => runCmd({ type: "develop", officerId: bestInt.id, gold: 200 })} disabled={city.gold < 200} />
      )}
      {menu === "flood" && (
        <MiniAction label={`치수 — ${bestInt.name}(지력 ${bestInt.int}), 금 200`} onGo={() => runCmd({ type: "flood", officerId: bestInt.id, gold: 200 })} disabled={city.gold < 200} />
      )}
      {menu === "give" && (
        <MiniAction label={`시여 — ${bestChr.name}(매력 ${bestChr.chr}), 쌀 1000`} onGo={() => runCmd({ type: "give", officerId: bestChr.id, rice: 1000 })} disabled={city.rice < 1000} />
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
      {menu === "transport" && (
        <div className="space-y-1 text-[11px]">
          {neighborsMine.map((t) => (
            <button key={t.id} className="block w-full text-left rounded bg-white/5 px-2 py-1 hover:bg-white/15" onClick={() => runCmd({ type: "transport", officerId: bestChr.id, toCity: t.id, gold: Math.floor(city.gold / 2), rice: Math.floor(city.rice / 2) })}>
              {t.id}. {t.name} — 금·쌀 절반 수송 ({bestChr.name} 호송)
            </button>
          ))}
          {neighborsMine.length === 0 && <p className="text-white/40">수송할 인접 자국 도시가 없습니다</p>}
        </div>
      )}
      {menu === "diplo" && (
        <div className="space-y-1 text-[11px]">
          <p className="text-white/50">본국 외교 — 사자: {bestChr.name} (매력 {bestChr.chr})</p>
          {otherFactions.map((f) => (
            <div key={f.id} className="flex gap-1 items-center">
              <span className="w-14" style={{ color: f.color }}>{f.name}{myFaction.allies.includes(f.id) && " 🤝"}</span>
              <button className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20" onClick={() => runCmd({ type: "diplomacy", officerId: bestChr.id, kind: "ally", targetFactionId: f.id })}>
                동맹 제의
              </button>
              <button className="rounded bg-white/10 px-2 py-0.5 hover:bg-white/20" disabled={city.gold < 200} onClick={() => runCmd({ type: "diplomacy", officerId: bestChr.id, kind: "gift", targetFactionId: f.id, gold: 200 })}>
                선물 (금 200)
              </button>
            </div>
          ))}
        </div>
      )}
      {menu === "plot" && (
        <div className="space-y-1 text-[11px] max-h-32 overflow-y-auto">
          <p className="text-white/50">위서(僞書) — 인접 적장의 충성을 흔든다 (실행: {bestInt.name}, 지력 {bestInt.int})</p>
          {enemyOfficersNearby.slice(0, 12).map((o) => (
            <button key={o.id} className="block w-full text-left rounded bg-white/5 px-2 py-1 hover:bg-white/15" onClick={() => runCmd({ type: "plot", officerId: bestInt.id, kind: "forgery", targetOfficerId: o.id })}>
              {o.name} ({game.factions[o.factionId ?? -1]?.name}) — 충성 {o.loyalty}
            </button>
          ))}
          {enemyOfficersNearby.length === 0 && <p className="text-white/40">인접에 적장이 없습니다</p>}
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
