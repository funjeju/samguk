import { calcPower } from "./battle";
import { DUEL } from "./constants";
import { GENERAL_BY_ID } from "./roster";
import type { CardInstance, City, DuelResult, DuelRound, Scenario } from "./types";

// 일기토 발동 판정 (GDD §2.6) — 라이벌 쌍은 확정, 그 외 양측 전투 85+
// 2:2(모사 동반) 턴에는 발동하지 않음 — 일기토는 단기접전의 낭만
export function checkDuelTrigger(my: CardInstance, opp: CardInstance): { trigger: boolean; isRival: boolean } {
  const gm = GENERAL_BY_ID[my.generalId];
  const go = GENERAL_BY_ID[opp.generalId];
  const isRival = (gm.rivals ?? []).includes(go.name) || (go.rivals ?? []).includes(gm.name);
  if (isRival) return { trigger: true, isRival: true };
  const both85 = my.stats.combat >= DUEL.combatThreshold && opp.stats.combat >= DUEL.combatThreshold;
  return { trigger: both85, isRival: false };
}

const UNDERDOG_EVENTS = ["허점을 파고든 일격!", "필사의 일격!", "낙마 유도!", "심리전으로 빈틈을 열다!"];
const FAVORITE_EVENTS = ["정면 격돌 승리", "강맹한 창격", "노련한 받아치기", "압도적인 기세"];

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// 5합 3선취에서 언더독 최종 승률이 target이 되는 합당 승률 p를 이분 탐색으로 역산
function invertBestOf5(target: number): number {
  const winProb = (p: number) => {
    // P(5번 중 3승 이상) = C(5,3)p³(1-p)² + C(5,4)p⁴(1-p) + p⁵
    const q = 1 - p;
    return 10 * p ** 3 * q ** 2 + 5 * p ** 4 * q + p ** 5;
  };
  let lo = 0,
    hi = 0.5;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (winProb(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// "이유 있는 언더독" — 반전 확률은 판의 공개된 맥락(수치차·역사·전장·국가)에서 파생 (GDD §2.6)
export function resolveDuel(
  my: CardInstance,
  opp: CardInstance,
  scenario: Scenario,
  city: City,
  isRival: boolean,
  eraFloor?: number
): DuelResult {
  const myBd = calcPower(my, scenario, city, eraFloor);
  const oppBd = calcPower(opp, scenario, city, eraFloor);

  // 전투 우위자 = 기본 승자 (동률이면 유효 전투력, 그것도 같으면 나)
  const favorite: "me" | "opp" =
    my.stats.combat !== opp.stats.combat
      ? my.stats.combat > opp.stats.combat
        ? "me"
        : "opp"
      : myBd.total >= oppBd.total
        ? "me"
        : "opp";
  const [favCard, dogCard] = favorite === "me" ? [my, opp] : [opp, my];
  const [favBd, dogBd] = favorite === "me" ? [myBd, oppBd] : [oppBd, myBd];
  const dogGen = GENERAL_BY_ID[dogCard.generalId];
  const favGen = GENERAL_BY_ID[favCard.generalId];

  // 기본 확률: 전투 수치 차이 (차이 0 → 0.20, 차이 30 → 0.08)
  let p = 0.2 - (favCard.stats.combat - dogCard.stats.combat) * 0.004;
  // 역사 가중: 이 시대에 누가 유리한가
  p *= dogBd.eraMult / favBd.eraMult;
  // 전장 가중: 언더독의 홈이면 반전 폭 확대
  if (dogGen.homeCity === city.name) p *= 1.25;
  else if (favGen.homeCity === city.name) p *= 0.8;
  // 국가 가중: 시나리오가 밀어주는 국가인가
  const favored = scenario.statMods.map((m) => m.faction).filter(Boolean);
  if (favored.includes(dogGen.faction)) p *= 1.2;
  if (favored.includes(favGen.faction)) p *= 0.85;
  // 지략 우위 언더독은 심리전 가능 ("지력이 무력을 이겼다")
  if (dogCard.stats.intellect > favCard.stats.intellect + 10) p *= 1.15;

  // 클램프는 "최종 반전 확률"에 적용 (GDD §2.6 — 운:실력 다이얼)
  const upsetP = Math.min(DUEL.clampMax, Math.max(DUEL.clampMin, p));
  // 3합 선취제에서 최종 반전율이 upsetP가 되도록 합당 확률을 역산
  const roundP = invertBestOf5(upsetP);

  // 5합 진행, 3합 선취
  const rounds: DuelRound[] = [];
  let favWins = 0;
  let dogWins = 0;
  for (let n = 1; n <= DUEL.rounds && favWins < DUEL.winAt && dogWins < DUEL.winAt; n++) {
    const upset = Math.random() < roundP;
    const roundWinner: "me" | "opp" = upset ? (favorite === "me" ? "opp" : "me") : favorite;
    if (upset) dogWins++;
    else favWins++;
    rounds.push({ n, winner: roundWinner, event: upset ? pick(UNDERDOG_EVENTS) : pick(FAVORITE_EVENTS) });
  }
  const winner: "me" | "opp" =
    dogWins >= DUEL.winAt ? (favorite === "me" ? "opp" : "me") : favorite;

  return { isRival, favorite, upsetP: Math.round(upsetP * 100) / 100, rounds, winner };
}
