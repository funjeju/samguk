// 삼국지2 재구성 — 전략층 엔진
// 규칙은 조사로 확정된 원작 구조, 수치 공식은 오리지널 (docs/삼국지2_재구성_설계.md §9)
import type { BattleReport, CityState, Command, Faction, GameState, Officer } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

export const officersIn = (s: GameState, cityId: number, factionId: number | null) =>
  Object.values(s.officers).filter((o) => o.alive && o.cityId === cityId && o.factionId === factionId);

export const freeOfficersIn = (s: GameState, cityId: number) =>
  Object.values(s.officers).filter(
    (o) => o.alive && o.factionId === null && o.cityId === cityId
  );

export const factionCities = (s: GameState, factionId: number) =>
  Object.values(s.cities).filter((c) => c.factionId === factionId);

function push(s: GameState, msg: string) {
  s.log = [...s.log.slice(-59), msg];
}

const compatDist = (a: number, b: number) => Math.abs(a - b); // 선형 상성

// ── 커맨드 실행 ────────────────────────────────────────────
export function executeCommand(
  prev: GameState,
  cityId: number,
  cmd: Command
): { state: GameState; recruited?: string } {
  const s = clone(prev);
  const city = s.cities[cityId];

  // 세율 설정: 행동력 소모 없음 (원작 Rate)
  if (cmd.type === "setTax") {
    city.taxRate = clamp(cmd.rate, 20, 80);
    push(s, `${city.name} 세율을 ${city.taxRate}%로 조정했다`);
    return { state: s };
  }

  const actorId = "officerId" in cmd ? cmd.officerId : (cmd as { officerIds: string[] }).officerIds[0];
  const actor = s.officers[actorId];
  if (!actor || actor.acted || actor.cityId !== cityId || actor.wounded > 0) return { state: prev };
  const faction = s.factions[actor.factionId!];
  const ruler = s.officers[faction.rulerId];
  let recruited: string | undefined;

  switch (cmd.type) {
    case "develop": {
      const gold = Math.min(cmd.gold, city.gold);
      if (gold < 50) return { state: prev };
      city.gold -= gold;
      const gain = Math.round((4 + actor.int / 12) * Math.pow(gold / 200, 0.7));
      city.land = clamp(city.land + gain);
      push(s, `${actor.name}, ${city.name} 개간 — 토지 +${gain} (금 ${gold})`);
      break;
    }
    case "flood": {
      const gold = Math.min(cmd.gold, city.gold);
      if (gold < 50) return { state: prev };
      city.gold -= gold;
      const gain = Math.round((4 + actor.int / 12) * Math.pow(gold / 200, 0.7));
      city.flood = clamp(city.flood + gain);
      push(s, `${actor.name}, ${city.name} 치수 — 치수 +${gain} (금 ${gold})`);
      break;
    }
    case "give": {
      const rice = Math.min(cmd.rice, city.rice);
      if (rice < 100) return { state: prev };
      city.rice -= rice;
      const gain = Math.round((rice / city.population) * 3000 + actor.chr / 20);
      city.peace = clamp(city.peace + gain);
      push(s, `${actor.name}, 백성에게 쌀 ${rice}을 나누다 — 민충성 +${gain}`);
      break;
    }
    case "levy": {
      const gold = Math.round(city.population / 400);
      const rice = Math.round(city.population / 80);
      city.gold += gold;
      city.rice += rice;
      city.peace = clamp(city.peace - rnd(8, 14));
      faction.trust = clamp(faction.trust - 3);
      push(s, `${actor.name}, ${city.name} 임시징수 — 금 +${gold} 쌀 +${rice}, 민심이 흉흉하다`);
      break;
    }
    case "trade": {
      if (cmd.mode === "buyRice") {
        const gold = Math.min(cmd.amount, city.gold);
        const rice = Math.round((gold / 100) * city.ricePrice);
        city.gold -= gold;
        city.rice += rice;
        push(s, `상인에게서 쌀 ${rice} 매입 (금 ${gold}, 시세 ${city.ricePrice})`);
      } else if (cmd.mode === "sellRice") {
        const rice = Math.min(cmd.amount, city.rice);
        const gold = Math.round((rice / city.ricePrice) * 100);
        city.rice -= rice;
        city.gold += gold;
        push(s, `상인에게 쌀 ${rice} 매각 (금 +${gold}, 시세 ${city.ricePrice})`);
      } else if (cmd.mode === "buyWeapon") {
        const gold = Math.min(cmd.amount, city.gold);
        city.gold -= gold;
        city.weapons += gold; // 무기 1 = 금 1 (원작)
        push(s, `무기 ${gold}개 구입`);
      } else {
        const count = Math.min(Math.floor(city.gold / 100), cmd.amount);
        city.gold -= count * 100;
        city.horses += count;
        push(s, `말 ${count}필 구입 (필당 금 100)`);
      }
      break;
    }
    case "reward": {
      // 원작 규칙: 포상은 한 달에 1명만, 상승폭은 군주 매력 비례
      if (s.rewardUsed) {
        push(s, "포상은 한 달에 한 명에게만 내릴 수 있다");
        return { state: prev };
      }
      const target = s.officers[cmd.targetId];
      const gold = Math.min(cmd.gold, city.gold, 100);
      if (!target || gold < 10) return { state: prev };
      city.gold -= gold;
      const gain = Math.round((gold / 10) * (ruler.chr / 40));
      target.loyalty = clamp(target.loyalty + gain);
      s.rewardUsed = true;
      push(s, `${target.name}에게 금 ${gold} 포상 — 충성 +${gain} (${target.loyalty})`);
      break;
    }
    case "transport": {
      // 수송: 물자만 자국 인접 도시로 (장수는 호송 후 복귀)
      const to = s.cities[cmd.toCity];
      if (!city.neighbors.includes(cmd.toCity) || to.factionId !== faction.id) return { state: prev };
      const gold = Math.min(cmd.gold, city.gold);
      const rice = Math.min(cmd.rice, city.rice);
      city.gold -= gold;
      city.rice -= rice;
      to.gold = Math.min(30000, to.gold + gold);
      to.rice = Math.min(3000000, to.rice + rice);
      push(s, `${actor.name}, ${to.name}(으)로 수송 — 금 ${gold}, 쌀 ${rice}`);
      break;
    }
    case "search": {
      const found = freeOfficersIn(s, cityId).filter((o) => !o.discovered);
      if (found.length > 0 && Math.random() < 0.35 + actor.chr / 200) {
        found[0].discovered = true;
        push(s, `${actor.name}의 수색 — 재야의 인재 ${found[0].name}을(를) 찾아냈다!`);
      } else if (Math.random() < 0.3) {
        const g = rnd(50, 200);
        city.gold += g;
        push(s, `${actor.name}의 수색 — 숨은 재물 발견, 금 +${g}`);
      } else {
        push(s, `${actor.name}의 수색 — 별다른 소득이 없었다`);
      }
      break;
    }
    case "recruit": {
      const target = s.officers[cmd.targetId];
      if (!target || !target.alive) return { state: prev };
      const gap = compatDist(ruler.compat, target.compat);
      let p =
        35 + actor.chr / 4 + faction.trust / 10 - gap * 1.2 - target.loyalty / 2 - target.honor / 8;
      p = clamp(p, 5, 90);
      if (Math.random() * 100 < p) {
        const fromFaction = target.factionId;
        target.factionId = faction.id;
        target.cityId = cityId;
        target.loyalty = clamp(90 - gap - Math.floor(target.ambition / 10), 40, 95);
        recruited = target.id;
        push(s, `${target.name}이(가) ${faction.name}군에 합류했다! ${fromFaction !== null ? "(병력을 이끌고 왔다)" : ""}`);
      } else {
        push(s, `${target.name}, 등용을 거절하다 (성공률 ${Math.round(p)}%)`);
      }
      break;
    }
    case "conscript": {
      const units = Math.min(cmd.amount, Math.floor(city.gold / 10), Math.floor(city.rice / 100));
      const men = units * 100;
      if (men <= 0 || city.population < men * 2) return { state: prev };
      city.gold -= units * 10;
      city.rice -= units * 100;
      city.population -= men;
      city.peace = clamp(city.peace - Math.ceil(units / 10));
      actor.soldiers += men;
      actor.trained = clamp(actor.trained - 10);
      push(s, `${actor.name}, ${men}명 징병 (금 ${units * 10}, 쌀 ${units * 100})`);
      break;
    }
    case "train": {
      const gain = rnd(7, 12) + Math.floor(actor.war / 25);
      actor.trained = clamp(actor.trained + gain);
      push(s, `${actor.name}, 병사 조련 — 훈련 +${gain} (${actor.trained})`);
      break;
    }
    case "move": {
      const to = s.cities[cmd.toCity];
      if (!city.neighbors.includes(cmd.toCity)) return { state: prev };
      if (to.factionId !== faction.id && to.factionId !== null) return { state: prev };
      const gold = Math.min(cmd.gold, city.gold);
      const rice = Math.min(cmd.rice, city.rice);
      city.gold -= gold;
      city.rice -= rice;
      to.gold += gold;
      to.rice += rice;
      for (const oid of cmd.officerIds) {
        const o = s.officers[oid];
        if (o && o.cityId === cityId && !o.acted) {
          o.cityId = cmd.toCity;
          o.acted = true;
        }
      }
      if (to.factionId === null) {
        to.factionId = faction.id;
        push(s, `${faction.name}군, 공백지 ${to.name}에 무혈 입성!`);
      } else {
        push(s, `${cmd.officerIds.length}명의 장수가 ${to.name}(으)로 이동 (금 ${gold}, 쌀 ${rice} 수송)`);
      }
      return { state: s, recruited };
    }
    case "war": {
      const to = s.cities[cmd.toCity];
      if (!city.neighbors.includes(cmd.toCity) || to.factionId === faction.id) return { state: prev };
      if (to.factionId === null) {
        // 공백지 점령
        for (const oid of cmd.officerIds) {
          const o = s.officers[oid];
          if (o) {
            o.cityId = cmd.toCity;
            o.acted = true;
          }
        }
        to.factionId = faction.id;
        push(s, `${faction.name}군, 공백지 ${to.name}을 점령!`);
        return { state: s, recruited };
      }
      const report = resolveBattle(s, faction.id, cityId, cmd.toCity, cmd.officerIds.slice(0, 5));
      s.pendingBattle = report;
      // 플레이어 승리 시 수비측 포로는 플레이어가 직접 처리
      if (report.winner === "attacker" && faction.id === s.playerFactionId) {
        s.pendingCaptives = report.captured.filter((id) => !s.officers[id]?.isRuler || true);
      }
      return { state: s, recruited };
    }
    case "plot": {
      const target = s.officers[cmd.targetOfficerId];
      if (!target) return { state: prev };
      if (Math.random() < 0.3 + actor.int / 250) {
        const drop = rnd(8, 18);
        target.loyalty = clamp(target.loyalty - drop);
        push(s, `위서(僞書) 성공 — ${target.name}의 충성이 흔들린다 (-${drop})`);
      } else {
        push(s, `위서 실패 — ${target.name}은 속지 않았다`);
      }
      break;
    }
    case "diplomacy": {
      const tf = s.factions[cmd.targetFactionId];
      if (!tf || !tf.alive) return { state: prev };
      if (cmd.kind === "gift") {
        const gold = Math.min(cmd.gold ?? 200, city.gold);
        city.gold -= gold;
        push(s, `${tf.name}에게 금 ${gold}을 선물 — 관계가 부드러워졌다`);
        faction.trust = clamp(faction.trust + 2);
      } else {
        const tRuler = s.officers[tf.rulerId];
        const p = clamp(30 + actor.chr / 4 + faction.trust / 5 - compatDist(ruler.compat, tRuler.compat), 5, 85);
        if (Math.random() * 100 < p) {
          faction.allies = [...new Set([...faction.allies, tf.id])];
          tf.allies = [...new Set([...tf.allies, faction.id])];
          push(s, `${tf.name}과(와) 동맹 성립!`);
        } else {
          push(s, `${tf.name}, 동맹을 거절하다`);
        }
      }
      break;
    }
  }
  actor.acted = true;
  return { state: s, recruited };
}

// ── 전투 (전술 요약형 30일 시뮬레이션) ────────────────────
function unitPower(o: Officer, weaponRate: number) {
  return o.soldiers * (0.4 + o.trained / 150 + weaponRate / 250) * (0.6 + o.war / 150);
}

function resolveBattle(
  s: GameState,
  attackerFid: number,
  fromCity: number,
  toCity: number,
  attackerIds: string[]
): BattleReport {
  const city = s.cities[toCity];
  const from = s.cities[fromCity];
  const defFid = city.factionId!;
  const atkF = s.factions[attackerFid];
  const defF = s.factions[defFid];
  const rounds: string[] = [];

  const atk = attackerIds.map((id) => s.officers[id]).filter((o) => o && !o.acted && o.soldiers > 0);
  const def = officersIn(s, toCity, defFid).filter((o) => o.soldiers > 0).slice(0, 10);
  atk.forEach((o) => (o.acted = true));

  rounds.push(`${atkF.name}군 ${atk.length}부대(${atk.reduce((x, o) => x + o.soldiers, 0)}명), ${city.name}에 침공!`);

  let report: BattleReport = {
    attacker: attackerFid,
    defender: defFid,
    cityId: toCity,
    rounds,
    winner: "defender",
    captured: [],
  };

  if (def.length === 0) {
    rounds.push(`${city.name}은 무방비였다 — 무혈 점령!`);
    report.winner = "attacker";
    captureCity(s, report, atk, []);
    return report;
  }

  // 일기토 (개전 시 1회) — 양측 최고 무력 장수. 수비측이 수락/거절 (원작 규칙)
  const aBest = atk.reduce((a, b) => (a.war >= b.war ? a : b));
  const dBest = def.reduce((a, b) => (a.war >= b.war ? a : b));
  let duelWinner: Officer | null = null;
  let duelDeclined = false;
  if (aBest.war >= 80 || dBest.war >= 80) {
    // 수락 판단: 무력이 크게 밀리지 않거나, 야망 높은 장수는 멋대로 받아버림
    const accepts = dBest.war >= aBest.war - 10 || dBest.ambition >= 80;
    if (!accepts) {
      // 거절 페널티: 전 부대 병사 ~8% 탈주 (원작 실측치)
      def.forEach((o) => (o.soldiers = Math.floor(o.soldiers * 0.92)));
      rounds.push(`${dBest.name}, ${aBest.name}의 일기토를 거절! 수비군 사기가 꺾여 병사들이 탈주한다 (-8%)`);
      duelDeclined = true;
    }
  }
  if (!duelDeclined && (aBest.war >= 80 || dBest.war >= 80)) {
    const log: string[] = [];
    let aHp = 3;
    let dHp = 3;
    while (aHp > 0 && dHp > 0) {
      const pA = aBest.war / (aBest.war + dBest.war);
      if (Math.random() < pA) {
        dHp--;
        log.push(`${aBest.name}의 일격! ${dBest.name} 위태롭다`);
      } else {
        aHp--;
        log.push(`${dBest.name}의 반격! ${aBest.name} 밀린다`);
      }
    }
    const winner = aHp > 0 ? aBest : dBest;
    const loser = aHp > 0 ? dBest : aBest;
    duelWinner = winner;
    // 무력작 (원작 공식): 저무력이 이기면 (승+패)/2
    if (winner.war < loser.war) {
      const newWar = Math.floor((winner.war + loser.war) / 2);
      log.push(`${winner.name}, 격상의 승리! 무력 ${winner.war} → ${newWar}`);
      winner.war = newWar;
    }
    // 패자는 부대째 이탈 + 포로 (원작 규칙)
    log.push(`${loser.name}, 일기토 패배 — 부대와 함께 사로잡혔다!`);
    loser.soldiers = 0;
    report.captured.push(loser.id);
    report.duel = { a: aBest.id, b: dBest.id, winner: winner.id, log };
    rounds.push(`⚔ 일기토! ${aBest.name}(무력${aBest.war}) vs ${dBest.name}(무력${dBest.war}) — ${winner.name} 승리`);
  }

  // 30일 소모전 — 무장도(도시 무기 보유량 대비 병사) 양측 모두 반영
  const weaponRateDef = clamp(Math.round((city.weapons / Math.max(1, def.reduce((x, o) => x + o.soldiers, 0))) * 100), 30, 100);
  const weaponRateAtk = clamp(Math.round((from.weapons / Math.max(1, atk.reduce((x, o) => x + o.soldiers, 0))) * 100), 30, 100);
  let atkRice = Math.min(from.rice, atk.reduce((x, o) => x + o.soldiers, 0));
  from.rice -= atkRice;
  for (let day = 1; day <= 30; day++) {
    const atkAlive = atk.filter((o) => o.soldiers > 0 && !report.captured.includes(o.id));
    const defAlive = def.filter((o) => o.soldiers > 0 && !report.captured.includes(o.id));
    if (atkAlive.length === 0) {
      rounds.push(`${day}일째 — 공격군 전멸. ${defF.name}군 방어 성공!`);
      report.winner = "defender";
      finishDefense(s, report, atk, def);
      return report;
    }
    if (defAlive.length === 0) {
      rounds.push(`${day}일째 — 수비군 전멸. ${city.name} 함락!`);
      report.winner = "attacker";
      captureCity(s, report, atk, def);
      return report;
    }
    let aPow = atkAlive.reduce((x, o) => x + unitPower(o, weaponRateAtk), 0);
    let dPow = defAlive.reduce((x, o) => x + unitPower(o, weaponRateDef), 0) * 1.25; // 수성 보정

    // 화계: 지력 85+ 장수 보유 시
    if (day % 7 === 3) {
      const aInt = Math.max(...atkAlive.map((o) => o.int));
      const dInt = Math.max(...defAlive.map((o) => o.int));
      if (aInt >= 85 && Math.random() < 0.4) {
        dPow *= 0.75;
        rounds.push(`${day}일째 — 공격군의 화계! 수비 진영이 불탄다`);
      } else if (dInt >= 85 && Math.random() < 0.4) {
        aPow *= 0.75;
        rounds.push(`${day}일째 — 수비군의 화계! 공격 진영이 화염에 휩싸인다`);
      }
    }

    // 하루 소모
    const total = aPow + dPow;
    const aLossRate = (dPow / total) * 0.055;
    const dLossRate = (aPow / total) * 0.055;
    atkAlive.forEach((o) => (o.soldiers = Math.max(0, Math.floor(o.soldiers * (1 - aLossRate)))));
    defAlive.forEach((o) => (o.soldiers = Math.max(0, Math.floor(o.soldiers * (1 - dLossRate)))));

    // 군량
    atkRice -= Math.floor(atkAlive.reduce((x, o) => x + o.soldiers, 0) / 30);
    city.rice = Math.max(0, city.rice - Math.floor(defAlive.reduce((x, o) => x + o.soldiers, 0) / 30));
    if (atkRice <= 0) {
      rounds.push(`${day}일째 — 공격군 군량 고갈, 퇴각!`);
      report.winner = "defender";
      finishDefense(s, report, atk, def);
      return report;
    }
    if (city.rice <= 0) {
      rounds.push(`${day}일째 — 성의 군량이 바닥났다. ${city.name} 개성(開城)!`);
      report.winner = "attacker";
      captureCity(s, report, atk, def);
      return report;
    }
    if (day === 10 || day === 20) {
      rounds.push(
        `${day}일째 — 공격군 ${atkAlive.reduce((x, o) => x + o.soldiers, 0)}명 vs 수비군 ${defAlive.reduce((x, o) => x + o.soldiers, 0)}명`
      );
    }
  }
  rounds.push(`30일 경과 — 결판나지 않아 공격군이 물러났다 (수비 승)`);
  report.winner = "defender";
  finishDefense(s, report, atk, def);
  return report;
}

function captureCity(s: GameState, report: BattleReport, atk: Officer[], def: Officer[]) {
  const city = s.cities[report.cityId];
  const atkF = s.factions[report.attacker];
  city.factionId = atkF.id;
  city.peace = clamp(city.peace - 15);
  // 공격군 입성
  atk.filter((o) => o.soldiers > 0).forEach((o) => (o.cityId = report.cityId));
  // 수비 장수: 포로 or 인접 자국 도시로 도주
  for (const o of def) {
    if (report.captured.includes(o.id)) {
      o.cityId = report.cityId;
      continue;
    }
    const escape = city.neighbors.find((n) => s.cities[n].factionId === o.factionId);
    if (escape && Math.random() < 0.5) {
      o.cityId = escape;
    } else {
      report.captured.push(o.id);
      o.cityId = report.cityId;
      o.soldiers = 0;
    }
  }
  push(s, `⚔ ${atkF.name}군, ${city.name} 함락! 포로 ${report.captured.length}명`);
  checkFactionCollapse(s, report.defender!);
}

function finishDefense(s: GameState, report: BattleReport, atk: Officer[], def: Officer[]) {
  // 공격 생존자는 귀환 (fromCity 개념 단순화: 그대로 원 도시 잔류)
  // 일기토 포로는 수비측이 획득 → 수비 세력이 AI면 즉시 등용/처리
  for (const id of report.captured) {
    const o = s.officers[id];
    if (!o) continue;
    if (atk.some((a) => a.id === id)) {
      // 공격측 장수가 잡힘 → 수비 세력 귀속 (원작: 포로 등용 100%)
      o.factionId = report.defender;
      o.cityId = report.cityId;
      o.loyalty = 50;
    }
  }
  report.captured = report.captured.filter((id) => def.some((d) => d.id === id));
}

function checkFactionCollapse(s: GameState, factionId: number) {
  const f = s.factions[factionId];
  if (!f.alive) return;
  if (factionCities(s, factionId).length === 0) {
    f.alive = false;
    Object.values(s.officers).forEach((o) => {
      if (o.factionId === factionId) {
        o.factionId = null;
        o.loyalty = 0;
        o.soldiers = 0;
      }
    });
    push(s, `💀 ${f.name} 세력 멸망...`);
  }
}

// ── 포로 처리 (플레이어) ──────────────────────────────────
export function processCaptive(prev: GameState, officerId: string, action: "recruit" | "release" | "execute"): GameState {
  const s = clone(prev);
  const o = s.officers[officerId];
  if (!o) return prev;
  s.pendingCaptives = s.pendingCaptives.filter((id) => id !== officerId);
  if (action === "recruit") {
    if (o.isRuler) {
      push(s, `${o.name}은 군주라 등용할 수 없다`);
      s.pendingCaptives.push(officerId);
      return s;
    }
    o.factionId = s.playerFactionId;
    o.loyalty = 60;
    push(s, `포로 ${o.name}, 아군에 합류 (원작 규칙: 포로는 거절하지 못한다)`);
  } else if (action === "release") {
    o.factionId = null;
    o.loyalty = 0;
    push(s, `${o.name}을(를) 풀어주었다 — 인덕이 알려진다`);
  } else {
    o.alive = false;
    if (o.isRuler) checkRulerDeath(s, o);
    push(s, `${o.name}, 참수형... 천하가 두려워한다`);
  }
  return s;
}

// ── AI 세력 턴 ─────────────────────────────────────────────
function aiFactionTurn(s: GameState, f: Faction) {
  const myCities = factionCities(s, f.id);
  for (const city of myCities) {
    const officers = officersIn(s, city.id, f.id).filter((o) => !o.acted && o.wounded === 0);
    for (const o of officers) {
      // 우선순위: 공격 기회 > 등용 > 내정 > 징병 > 훈련
      const myPower = officers.reduce((x, u) => x + u.soldiers * (1 + u.war / 100), 0);
      const targets = city.neighbors
        .map((n) => s.cities[n])
        .filter((n) => n.factionId !== f.id && !f.allies.includes(n.factionId ?? -1));
      const weak = targets.find((t) => {
        if (t.factionId === null) return true;
        const defPower = officersIn(s, t.id, t.factionId).reduce((x, u) => x + u.soldiers * (1 + u.war / 100), 0);
        return myPower > defPower * 1.8 && officers.length >= 2;
      });
      if (weak && o.isRuler === false && officers.filter((x) => !x.acted).length >= 2 && Math.random() < 0.5) {
        const party = officers.filter((x) => !x.acted && x.soldiers > 500).slice(0, 5);
        if (party.length >= 1) {
          if (weak.factionId === null) {
            party.forEach((p) => {
              p.cityId = weak.id;
              p.acted = true;
            });
            weak.factionId = f.id;
            push(s, `${f.name}군, 공백지 ${weak.name} 점령`);
          } else {
            const rep = resolveBattle(s, f.id, city.id, weak.id, party.map((p) => p.id));
            // AI 승리 시 포로 처리: 전원 등용 (원작 100%), 군주는 석방
            if (rep.winner === "attacker") {
              for (const cid of rep.captured) {
                const cap = s.officers[cid];
                if (cap.isRuler) {
                  cap.factionId = null;
                  cap.cityId = null;
                } else {
                  cap.factionId = f.id;
                  cap.loyalty = 55;
                }
              }
              if (rep.defender === s.playerFactionId) {
                push(s, `⚠ ${f.name}군이 아군 ${s.cities[rep.cityId].name}을 함락시켰다!`);
              }
            }
          }
          continue;
        }
      }
      if (o.acted) continue;
      // 등용
      const free = freeOfficersIn(s, city.id);
      if (free.length > 0 && Math.random() < 0.4) {
        const r = executeAiRecruit(s, f, o, free[0]);
        if (r) continue;
      }
      // 내정/징병/훈련
      if (city.gold > 500 && city.land < 90 && Math.random() < 0.4) {
        city.gold -= 200;
        city.land = clamp(city.land + Math.round(4 + o.int / 12));
      } else if (city.gold > 800 && o.war >= 70 && Math.random() < 0.5) {
        const units = Math.min(20, Math.floor(city.gold / 10), Math.floor(city.rice / 100));
        if (units > 0) {
          city.gold -= units * 10;
          city.rice -= units * 100;
          o.soldiers += units * 100;
        }
      } else if (o.trained < 90) {
        o.trained = clamp(o.trained + rnd(7, 12));
      }
      o.acted = true;
    }
  }
}

function executeAiRecruit(s: GameState, f: Faction, actor: Officer, target: Officer): boolean {
  const ruler = s.officers[f.rulerId];
  const gap = compatDist(ruler.compat, target.compat);
  const p = clamp(35 + actor.chr / 4 - gap * 1.2, 5, 85);
  actor.acted = true;
  if (Math.random() * 100 < p) {
    target.factionId = f.id;
    target.cityId = actor.cityId;
    target.loyalty = clamp(85 - gap, 40, 95);
    return true;
  }
  return false;
}

// ── 월말 처리 ─────────────────────────────────────────────
function checkRulerDeath(s: GameState, ruler: Officer) {
  const f = s.factions[ruler.factionId ?? -1];
  if (!f || !f.alive) return;
  // 후계자: 혈연 우선 → 충성 최고
  const candidates = Object.values(s.officers).filter((o) => o.alive && o.factionId === f.id && !o.isRuler);
  const heir =
    candidates.find((o) => o.blood > 0 && o.blood === ruler.blood) ??
    candidates.sort((a, b) => b.loyalty - a.loyalty)[0];
  if (!heir) {
    f.alive = false;
    factionCities(s, f.id).forEach((c) => (c.factionId = null));
    Object.values(s.officers).forEach((o) => {
      if (o.factionId === f.id) o.factionId = null;
    });
    push(s, `💀 ${f.name} 세력, 후계자 없이 소멸했다`);
    return;
  }
  heir.isRuler = true;
  heir.loyalty = 100;
  f.rulerId = heir.id;
  f.name = heir.name;
  // 원작 규칙: 승계 시 전 장수 충성 재계산 (요동)
  Object.values(s.officers).forEach((o) => {
    if (o.factionId === f.id && !o.isRuler) {
      o.loyalty = clamp(o.loyalty - rnd(10, 25), 20);
    }
  });
  push(s, `${ruler.name} 사망 — ${heir.name}이(가) 뒤를 이었다. 가신들이 동요한다!`);
}

export function endMonth(prev: GameState): GameState {
  const s = clone(prev);

  // AI 세력 행동 (총병력 약한 순 — 원작 순서)
  const aiFactions = s.factions
    .filter((f) => f.alive && !f.isPlayer)
    .sort((a, b) => {
      const pow = (f: Faction) =>
        Object.values(s.officers)
          .filter((o) => o.factionId === f.id && o.alive)
          .reduce((x, o) => x + o.soldiers, 0);
      return pow(a) - pow(b);
    });
  for (const f of aiFactions) aiFactionTurn(s, f);

  // ── 월말 공통 처리
  for (const city of Object.values(s.cities)) {
    // 쌀 시세 변동 (15~88)
    city.ricePrice = clamp(city.ricePrice + rnd(-12, 12), 15, 88);
    // 고세율은 민심을 갉아먹고, 저세율은 민심을 회복시킨다
    if (city.factionId !== null && city.taxRate !== 50 && Math.random() < 0.5) {
      city.peace = clamp(city.peace - Math.round((city.taxRate - 50) / 15));
    }
  }

  // 1월: 금 수입 + 인구 증가 + 수명 판정 / 7월: 쌀 수확
  if (s.month === 1) {
    for (const city of Object.values(s.cities)) {
      if (city.factionId === null) continue;
      const income = Math.round(
        (city.population / 100) * (city.land / 100) * (0.5 + city.peace / 100) * 2.2 * (city.taxRate / 50)
      );
      city.gold = Math.min(30000, city.gold + income);
      city.population = Math.min(3000000, Math.round(city.population * 1.02));
      if (city.factionId === s.playerFactionId) push(s, `${city.name} 세수 — 금 +${income}`);
    }
    // 수명 판정
    for (const o of Object.values(s.officers)) {
      if (!o.alive || o.factionId === null) continue;
      const age = s.year - o.birth;
      if (age > 54 && Math.random() < (age - 54) * 0.06) {
        o.alive = false;
        push(s, `☆ ${o.name}, 향년 ${age}세로 세상을 떠났다`);
        if (o.isRuler) checkRulerDeath(s, o);
      }
    }
  }
  if (s.month === 7) {
    for (const city of Object.values(s.cities)) {
      if (city.factionId === null) continue;
      const harvest = Math.round(
        (city.population / 100) * ((city.land + city.flood) / 200) * (0.5 + city.peace / 100) * 9
      );
      city.rice = Math.min(3000000, city.rice + harvest);
      if (city.factionId === s.playerFactionId) push(s, `${city.name} 수확 — 쌀 +${harvest}`);
    }
  }

  // 재해 (1·4·7·10월)
  if ([4, 7, 10].includes(s.month)) {
    for (const city of Object.values(s.cities)) {
      if (city.factionId === null || Math.random() > 0.12) continue;
      const roll = Math.random();
      if (roll < 0.3) {
        const dmg = Math.round(30 * (1 - city.flood / 120));
        city.land = clamp(city.land - Math.round(dmg / 3));
        city.population = Math.round(city.population * (1 - dmg / 400));
        push(s, `🌊 ${city.name}에 홍수! (치수 ${city.flood} → 피해 ${city.flood >= 70 ? "경미" : "막심"})`);
      } else if (roll < 0.55) {
        city.rice = Math.round(city.rice * 0.8);
        city.land = clamp(city.land - 5);
        city.peace = clamp(city.peace - 8);
        push(s, `🦗 ${city.name}에 메뚜기 떼가 창궐!`);
      } else if (roll < 0.8) {
        city.population = Math.round(city.population * 0.95);
        officersIn(s, city.id, city.factionId).forEach((o) => {
          if (Math.random() < 0.3) o.wounded = rnd(1, 3);
        });
        push(s, `☠ ${city.name}에 역병 — 장수들이 몸져누웠다`);
      } else {
        city.peace = clamp(city.peace - 6);
        city.flood = clamp(city.flood - 8);
        push(s, `🌀 ${city.name}에 태풍!`);
      }
    }
  }

  // 반란 (1·7월, 민충 30 미만)
  if ([1, 7].includes(s.month)) {
    for (const city of Object.values(s.cities)) {
      if (city.factionId !== null && city.peace < 30 && Math.random() < 0.4) {
        const f = s.factions[city.factionId];
        officersIn(s, city.id, city.factionId).forEach((o) => {
          const esc = city.neighbors.find((n) => s.cities[n].factionId === city.factionId);
          o.cityId = esc ?? city.id;
          if (!esc) o.factionId = null;
        });
        city.factionId = null;
        city.peace = 55;
        push(s, `🔥 ${city.name}에서 민란! ${f.name}군이 쫓겨났다`);
        checkFactionCollapse(s, f.id);
      }
    }
  }

  // 충성도 자연 감소 + 재야 출현 + 부상 회복
  for (const o of Object.values(s.officers)) {
    if (!o.alive) continue;
    if (o.wounded > 0) o.wounded--;
    if (o.factionId !== null && !o.isRuler) {
      const f = s.factions[o.factionId];
      const ruler = s.officers[f.rulerId];
      if (f.trust < 75) {
        const decay = compatDist(ruler.compat, o.compat) / 50 + (ruler.chr < 60 ? 0.5 : 0);
        if (Math.random() < decay / 3) o.loyalty = clamp(o.loyalty - 1);
      }
      // 저충성 이탈
      if (o.loyalty < 25 && Math.random() < 0.15) {
        push(s, `${o.name}, ${f.name}군을 떠나 재야로...`);
        o.factionId = null;
        o.soldiers = 0;
      }
    }
    if (o.factionId === null && o.cityId === null && o.appearYear && o.appearYear <= s.year && o.appearCity) {
      o.cityId = o.appearCity;
      // 재야 출현 (수색으로 발견 가능)
    }
  }

  // 다음 달
  s.month += 1;
  if (s.month > 12) {
    s.month = 1;
    s.year += 1;
  }
  Object.values(s.officers).forEach((o) => (o.acted = false));
  s.rewardUsed = false; // 포상 월 1회 리셋

  // 승패 판정
  const playerCities = factionCities(s, s.playerFactionId).length;
  const totalOwned = Object.values(s.cities).filter((c) => c.factionId !== null).length;
  if (playerCities === 0 || !s.factions[s.playerFactionId].alive) {
    s.finished = "lost";
    push(s, "천하의 꿈이 스러졌다...");
  } else if (playerCities === 41) {
    s.finished = "won";
    push(s, "🏆 천하 통일! 41개 주가 하나의 깃발 아래 모였다!");
  }
  void totalOwned;

  return s;
}
