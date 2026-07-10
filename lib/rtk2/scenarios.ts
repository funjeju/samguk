// 시나리오 6개 — 군주와 시작 도시 (원작 국번호 1~41 체계)
// 출처: 패미컴판 매뉴얼 복각 + kongming.net SNES FAQ + ja.wikipedia 교차 검증

export interface ScenarioDef {
  id: number;
  year: number;
  name: string;
  desc: string;
  // 군주 이름 → 시작 도시 번호들. 순서 = 엑셀 시나리오 블록의 군주 행 순서와 일치해야 함
  rulers: { name: string; cities: number[]; playable: boolean }[];
}

export const SCENARIO_DEFS: ScenarioDef[] = [
  {
    id: 1,
    year: 189,
    name: "동탁, 낙양을 어지럽히다",
    desc: "동탁이 낙양을 장악하고 뭇 별들이 일어선다 (189년)",
    rulers: [
      { name: "조조", cities: [9], playable: true },
      { name: "유비", cities: [4], playable: true },
      { name: "손견", cities: [21], playable: true },
      { name: "원소", cities: [6], playable: true },
      { name: "원술", cities: [19], playable: true },
      { name: "마등", cities: [14], playable: true },
      { name: "유언", cities: [30, 32, 33], playable: true },
      { name: "유표", cities: [20], playable: true },
      { name: "동탁", cities: [10, 11, 12], playable: true },
      { name: "공손찬", cities: [3], playable: true },
      { name: "도겸", cities: [16], playable: true },
      { name: "한복", cities: [7], playable: false },
      { name: "공융", cities: [8], playable: false },
      { name: "왕랑", cities: [24], playable: false },
      { name: "유요", cities: [28], playable: false },
    ],
  },
  {
    id: 2,
    year: 194,
    name: "군웅, 천하를 다투다",
    desc: "군웅이 할거하여 힘차게 패권을 겨룬다 (194년)",
    rulers: [
      { name: "조조", cities: [10, 11], playable: true },
      { name: "유비", cities: [16], playable: true },
      { name: "손책", cities: [24], playable: true },
      { name: "원소", cities: [6, 7], playable: true },
      { name: "원술", cities: [17, 19], playable: true },
      { name: "마등", cities: [14], playable: true },
      { name: "유장", cities: [32, 33, 34], playable: true },
      { name: "유표", cities: [20, 21], playable: true },
      { name: "여포", cities: [9], playable: true },
      { name: "공손찬", cities: [3], playable: true },
      { name: "이각", cities: [12], playable: true },
      { name: "장로", cities: [29], playable: false },
      { name: "공융", cities: [8], playable: false },
      { name: "양봉", cities: [5], playable: false },
      { name: "유요", cities: [28], playable: false },
    ],
  },
  {
    id: 3,
    year: 201,
    name: "유비, 형주에 엎드리다",
    desc: "유비가 형주에 숨어 비육지탄을 노래한다 (201년)",
    rulers: [
      { name: "조조", cities: [9, 10, 11, 16, 17], playable: true },
      { name: "유비", cities: [19], playable: true },
      { name: "손권", cities: [18, 24, 25, 27], playable: true },
      { name: "원소", cities: [1, 2, 3, 6, 7, 8], playable: true },
      { name: "유장", cities: [31, 32, 33, 34], playable: true },
      { name: "마등", cities: [14, 15], playable: true },
      { name: "장로", cities: [29], playable: true },
      { name: "유표", cities: [20, 21, 22, 23], playable: true },
    ],
  },
  {
    id: 4,
    year: 208,
    name: "조조, 천하를 넘보다",
    desc: "조조가 화북을 제압하고 천하를 바라본다 (208년)",
    rulers: [
      { name: "조조", cities: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 17], playable: true },
      { name: "유비", cities: [19], playable: true },
      { name: "손권", cities: [18, 24, 25, 27], playable: true },
      { name: "마등", cities: [14, 15], playable: true },
      { name: "유장", cities: [30, 31, 32, 33, 34], playable: true },
      { name: "금선", cities: [20], playable: true },
      { name: "한현", cities: [21], playable: true },
      { name: "조범", cities: [22], playable: true },
      { name: "유도", cities: [23], playable: true },
      { name: "장로", cities: [29], playable: true },
    ],
  },
  {
    id: 5,
    year: 215,
    name: "천하삼분, 관우 형주를 지키다",
    desc: "천하가 셋으로 나뉘고 관우가 형주를 지킨다 (215년)",
    rulers: [
      { name: "조조", cities: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 29, 30], playable: true },
      { name: "유비", cities: [19, 20, 31, 32, 33, 34, 35], playable: true },
      { name: "손권", cities: [21, 22, 23, 24, 25, 26, 27, 28, 37, 38, 39, 40], playable: true },
      { name: "맹획", cities: [36], playable: true },
    ],
  },
  {
    id: 6,
    year: 220,
    name: "위·오·촉, 삼국이 서다",
    desc: "위·오·촉이 정립하여 삼국을 이룬다 (220년)",
    rulers: [
      { name: "조비", cities: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20], playable: true },
      { name: "유비", cities: [29, 30, 31, 32, 33, 34, 35], playable: true },
      { name: "손권", cities: [21, 22, 23, 24, 25, 26, 27, 28, 37, 38, 39, 40], playable: true },
      { name: "맹획", cities: [36], playable: true },
    ],
  },
];
