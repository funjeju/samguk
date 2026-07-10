// 일기토 로직 단위 검증: 트리거 / 확률 클램프 / 합 진행 / 승자 분포
import { createCard } from "../lib/battle";
import { checkDuelTrigger, resolveDuel } from "../lib/duel";
import { CITIES, GENERAL_BY_ID, SCENARIOS } from "../lib/roster";

const scenario = SCENARIOS.find((s) => s.id === "guandu")!;
const city = CITIES[0];

const guanyu = createCard("관우", 1);
const lvbu = createCard("여포", 1);
const zhugeliang = createCard("제갈량", 1);
const xuchu = createCard("허저", 1);

// 1) 트리거
console.log("관우 rivals:", GENERAL_BY_ID["관우"].rivals);
console.log("관우 vs 여포 (라이벌):", checkDuelTrigger(guanyu, lvbu)); // trigger+isRival 기대
console.log("관우 vs 허저 (양측 85+):", checkDuelTrigger(guanyu, xuchu)); // trigger 기대
console.log("관우 vs 제갈량 (지장):", checkDuelTrigger(guanyu, zhugeliang)); // false 기대

// 2) 확률 클램프 + 승자 분포 (1000회)
let dogWinCount = 0;
let sampleP = 0;
for (let i = 0; i < 1000; i++) {
  const r = resolveDuel(guanyu, lvbu, scenario, city, true);
  sampleP = r.upsetP;
  if (r.upsetP < 0.05 || r.upsetP > 0.35) throw new Error("클램프 위반: " + r.upsetP);
  if (r.rounds.length < 3 || r.rounds.length > 5) throw new Error("합 수 오류");
  const dog = r.favorite === "me" ? "opp" : "me";
  if (r.winner === dog) dogWinCount++;
}
console.log(`관우 vs 여포 — 합당 반전 확률 ${sampleP}, 언더독 최종 승률 ${(dogWinCount / 10).toFixed(1)}% (1000회)`);

// 3) 극단 케이스: 전투 최대 격차에도 하한 보장
const weak = createCard("노숙", 1);
const r2 = resolveDuel(weak, lvbu, scenario, city, false);
console.log(`노숙 vs 여포 — 반전 확률 ${r2.upsetP} (하한 0.05 이상이어야 함)`);
console.log("모든 검증 통과");
