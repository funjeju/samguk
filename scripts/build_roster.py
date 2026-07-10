# -*- coding: utf-8 -*-
"""
로스터 빌드 파이프라인
- 기준 명단: 삼국지2 장수 능력표 (351명)
- 수치: 역대 시리즈(2~14PK) z-score 정규화 → 평균 → 백분위 → 우리 스케일(25~99) 재매핑
  (특정 작품 수치 테이블 복제가 아닌 독자 밸런싱 — GDD §4.5 저작권 안전선 준수)
- 활동 연도·연고 도시·인연: 14PK 정리표에서 이름 매칭 (S2 생년/출현지역으로 폴백)
- 국가: 수동 사전(주요 인물) + S2 상성 휴리스틱(조조1/유비50/손견100 근접도) + 검수 CSV 출력
출력: lib/roster_full.json, docs/로스터_검수용.csv
"""
import json, os, re, sys, unicodedata
import pandas as pd
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

STAT_COLS = {
    "combat": ["무력", "초기무력"],
    "intellect": ["지력", "초기지력"],
    "politics": ["정치", "초기정치"],
    "leadership": ["통솔", "초기통솔", "통무?", "통솔력"],
}
NAME_COLS = ["이름", "성명", "무장", "장수", "이름 "]

SERIES = [
    ("삼국지2 장수 능력표.xlsx", "장수 능력표"),
    ("삼국지3 장수 능력치-full.xls", "자료"),
    ("삼국지4PK 공략.xlsx", "삼국지장수"),
    ("삼국지5 정리표.xlsx", "무장목록"),
    ("삼국지6 능력표.xlsx", "삼국지6 장수정보"),
    ("삼국지7 능력표.xlsx", "무장목록"),
    ("삼국지8 장수 능력표.xlsx", "능력표"),
    ("삼국지9 능력표.xlsx", "장수목록"),
    ("삼국지10 장수 능력표.xlsx", "무장 목록"),
    ("삼국지11 장수 능력표.xlsx", "삼국지11 장수"),
    ("삼국지12+무장목록(색체).xlsx", "뷰어"),
    ("삼국지13 장수 능력표.xlsx", "장수 능력표"),
    ("삼국지14PK 정리표.xlsx", "장수목록"),
]

def norm_name(x):
    if not isinstance(x, str):
        return None
    s = unicodedata.normalize("NFC", x).strip().replace(" ", "")
    s = re.sub(r"[0-9]+$", "", s)  # 동명이인 suffix (손소2)
    return s or None

def find_header(df):
    for i in range(min(6, len(df))):
        row = [str(v) for v in df.iloc[i].tolist()]
        if any("무력" in v for v in row) and any(any(n == v.strip() for n in NAME_COLS) or "성명" in v or "무장" in v or "이름" in v for v in row):
            return i
    return None

def load_series(path, sheet):
    raw = pd.read_excel(path, sheet_name=sheet, header=None)
    h = find_header(raw)
    if h is None:
        return None
    df = pd.read_excel(path, sheet_name=sheet, header=h)
    df.columns = [str(c).strip() for c in df.columns]
    name_col = next((c for c in df.columns if c in NAME_COLS or c.replace(" ", "") in ("이름", "성명", "무장")), None)
    if name_col is None:
        return None
    out = pd.DataFrame()
    out["name"] = df[name_col].map(norm_name)
    for key, aliases in STAT_COLS.items():
        col = next((c for c in df.columns if c.replace(" ", "") in aliases), None)
        out[key] = pd.to_numeric(df[col], errors="coerce") if col else np.nan
    out = out.dropna(subset=["name"]).drop_duplicates(subset=["name"])
    return out

# ── 1) 기준 명단 (삼국지2) ──────────────────────────────────
s2 = pd.read_excel("삼국지2 장수 능력표.xlsx", sheet_name="장수 능력표")
s2.columns = [str(c).strip() for c in s2.columns]
s2["name"] = s2["이름"].map(norm_name)
s2 = s2.dropna(subset=["name"]).drop_duplicates(subset=["name"])
base_names = list(s2["name"])
s2_birth = dict(zip(s2["name"], pd.to_numeric(s2["생년"], errors="coerce")))
s2_affinity = dict(zip(s2["name"], pd.to_numeric(s2["상성"], errors="coerce")))
print(f"기준 명단(삼국지2): {len(base_names)}명")

s2b = pd.read_excel("삼국지2 장수 능력표.xlsx", sheet_name="시나리오 별 정리")
s2b.columns = [str(c).strip() for c in s2b.columns]
s2b["name"] = s2b["이름"].map(norm_name)
s2b = s2b.dropna(subset=["name"]).drop_duplicates(subset=["name"])
s2_debut = dict(zip(s2b["name"], pd.to_numeric(s2b.get("출현 연도"), errors="coerce")))
s2_region = dict(zip(s2b["name"], s2b.get("출현 지역")))

# ── 2) 시리즈별 수치 수집 → z-score ─────────────────────────
zscores = {k: {} for k in STAT_COLS}  # stat -> name -> [z,...]
used = []
for path, sheet in SERIES:
    try:
        df = load_series(path, sheet)
    except Exception as e:
        print(f"  스킵 {path}: {e}")
        continue
    if df is None:
        print(f"  헤더 인식 실패: {path}")
        continue
    used.append(path.split(" ")[0])
    for key in STAT_COLS:
        col = df[key].dropna()
        if len(col) < 50:
            continue
        mu, sd = col.mean(), col.std()
        if not sd or np.isnan(sd):
            continue
        for n, v in zip(df["name"], df[key]):
            if pd.notna(v):
                zscores[key].setdefault(n, []).append((v - mu) / sd)
print(f"수치 소스: {len(used)}개 시리즈")

def scaled_stats(names):
    result = {}
    for key in STAT_COLS:
        avg = {n: np.mean(zs) for n, zs in zscores[key].items() if n in names_set}
        ranked = pd.Series(avg).rank(pct=True)
        for n in names:
            if n in ranked:
                result.setdefault(n, {})[key] = int(round(25 + 74 * (ranked[n] ** 0.9)))
    return result

names_set = set(base_names)
stats = scaled_stats(base_names)

# ── 3) 14PK: 연도·연고·인연 ────────────────────────────────
pk = pd.read_excel("삼국지14PK 정리표.xlsx", sheet_name="장수목록", header=1)
pk.columns = [str(c).strip() for c in pk.columns]
pk["name"] = pk["무장"].map(norm_name)
pk = pk.dropna(subset=["name"]).drop_duplicates(subset=["name"])
pk_years = {
    r["name"]: (r.get("생년"), r.get("등장년"), r.get("사망"))
    for _, r in pk.iterrows()
}

pk2 = pd.read_excel("삼국지14PK 정리표.xlsx", sheet_name="PK장수목록", header=1)
pk2.columns = [str(c).strip() for c in pk2.columns]
pk2["name"] = pk2["무장"].map(norm_name)
pk2 = pk2.dropna(subset=["name"]).drop_duplicates(subset=["name"])
pk_city = dict(zip(pk2["name"], pk2.get("소재")))

rel_raw = pd.read_excel("삼국지14PK 정리표.xlsx", sheet_name="PK인간관계", header=1)
rel_raw.columns = [str(c).strip() for c in rel_raw.columns]
rel_raw["name"] = rel_raw["무장"].map(norm_name)
bonds, rivals = {}, {}
cols = list(rel_raw.columns)
# 친애무장 열은 '1'~'8', 혐오무장 열은 그 뒤 '1.1' 식으로 중복 명명됨 → 위치 기반
try:
    i_bond = cols.index("배우자")
except ValueError:
    i_bond = 5
for _, r in rel_raw.iterrows():
    n = r["name"]
    if not n:
        continue
    vals = [norm_name(v) for v in r.tolist()]
    others = [v for v in vals[3:] if v and v != n]
    # 마지막 5개 열 근처가 혐오 — 단순화: 뒤쪽 5열을 라이벌 후보로
    bonds[n] = [v for v in others[:10] if v in names_set][:4]
    tail = [norm_name(v) for v in r.tolist()[-5:]]
    rivals[n] = [v for v in tail if v and v in names_set and v != n][:3]

# ── 4) 국가 분류: 수동 사전 + 상성 휴리스틱 ─────────────────
WEI = "조조 조비 조예 조식 조창 조인 조홍 조진 조휴 조상 하후돈 하후연 하후무 하후패 장료 서황 악진 우금 이전 전위 허저 방덕 장합 곽가 순욱 순유 정욱 가후 사마의 사마사 사마소 사마염 종회 등애 왕쌍 학소 만총 문빙 유엽 화흠 왕랑 종요 진군 진태 곽회 관구검 제갈탄 왕릉 오질 조표? 신비 양수 최염 모개 두기 국연 왕찬 위풍? 손례 장제 환계 진교 유복 사마랑 조지? 조앙 조안민 하후상 조범?".split()
SHU = "유비 유선 관우 관평 관흥 관색 장비 장포 조운 마초 마대 황충 위연 강유 제갈량 방통 법정 마량 마속 장완 비의 동윤 왕평 요화 장익 장억 엄안 이엄 황권 유봉 맹달 간옹 손건 미축 미방 진지 곽유지 상랑 마등? 유표? 제갈첨 부첨 장굉? 오의 오반 뇌동 냉포? 주창 진도 사마가?".split()
WU = "손견 손책 손권 손호 손량 손휴 주유 노숙 여몽 육손 육항 육적 감녕 태사자 황개 정보 한당 주태 능통 능조 서성 정봉 반장 장소 장굉 고옹 제갈근 제갈각 주환 주연 주방 전종 우번 감택 설종 보즐 주치 여범 하제 손교 손환 손소 태사향? 서곤? 오국태?".split()
GUN = "여포 동탁 원소 원술 공손찬 공손도 유표 유장 유언 마등 한수 장로 도겸 공융 유요 왕윤 화웅 이각 곽사 장각 장보 장량 안량 문추 전풍 저수 심배 곽도 봉기 진궁 고순 장막 엄백호 왕광 교모 원유 포신 장초 한복 유대 교유 맹획 축융 목록 타사대왕 올돌골 김선? 양봉 장수 번조 장제 채모 괴량 괴월 문빙? 황조 감녕? 우길 좌자 화타 동승 원상 원담 원희 고간 장연 장임 엄백호".split()

manual = {}
for lst, f in [(WEI, "위"), (SHU, "촉"), (WU, "오"), (GUN, "군웅")]:
    for n in lst:
        n = n.rstrip("?")
        if n and n not in manual:  # 앞선 분류 우선 (채모/문빙 등은 위가 먼저면 위)
            manual[n] = f
# 중복 지정 시 위>촉>오>군웅 순으로 이미 처리됨 (GUN이 마지막이라 덮어쓰지 않음)

def classify(n):
    if n in manual:
        return manual[n], "사전"
    a = s2_affinity.get(n)
    if pd.notna(a):
        anchors = [("위", 1), ("촉", 50), ("오", 100)]
        best, dist = min(((f, abs(a - v)) for f, v in anchors), key=lambda t: t[1])
        if dist <= 13:
            return best, f"상성{int(a)}"
    return "군웅", "기본값"

# ── 5) 조립 ────────────────────────────────────────────────
def title_for(st, faction):
    c, i, p, l = st["combat"], st["intellect"], st["politics"], st["leadership"]
    top = max(c, i, p, l)
    if top == c:
        return "전장을 누비는 맹장" if c >= 85 else "한 자루 무예로 살아가는 무인"
    if top == i:
        return "계책으로 판을 뒤집는 지략가" if i >= 85 else "지모를 갖춘 참모"
    if top == p:
        return "나라의 살림을 떠받치는 재사" if p >= 85 else "행정에 밝은 문관"
    return "병사들이 따르는 지휘관" if l >= 85 else "묵묵히 소임을 다하는 장수"

roster, review_rows, missing_years = [], [], 0
for n in base_names:
    st = stats.get(n)
    if not st or len(st) < 2:
        continue
    # 일부 수치 누락 시 보유 수치 평균의 85%로 보충 (마이너 장수)
    if len(st) < 4:
        fill = int(np.mean(list(st.values())) * 0.85)
        for k in STAT_COLS:
            st.setdefault(k, max(20, min(fill, 75)))
    birth, debut, death = (pk_years.get(n) or (None, None, None))
    birth = birth if pd.notna(birth) else s2_birth.get(n)
    debut = debut if pd.notna(debut) else s2_debut.get(n)
    if pd.isna(debut) and pd.notna(birth):
        debut = birth + 20
    if pd.isna(death) and pd.notna(birth):
        death = birth + 55
    if pd.isna(debut) or pd.isna(death):
        missing_years += 1
        debut, death = 190, 230  # 최후 폴백
    debut, death = int(debut), int(death)
    if death <= debut:
        death = debut + 10
    span = death - debut
    peak_from = debut + round(span * 0.25)
    peak_to = debut + round(span * 0.75)
    faction, fsrc = classify(n)
    city = pk_city.get(n)
    city = str(city).strip() if isinstance(city, str) else (str(s2_region.get(n)).strip() if isinstance(s2_region.get(n), str) else "")
    roster.append({
        "id": n,
        "name": n,
        "faction": faction,
        "base": {k: int(st[k]) for k in ["combat", "politics", "intellect", "leadership"]},
        "activeFrom": debut,
        "activeTo": death,
        "peakFrom": peak_from,
        "peakTo": peak_to,
        "homeCity": city,
        "title": title_for(st, faction),
        "bonds": bonds.get(n, []),
        "rivals": rivals.get(n, []),
    })
    review_rows.append([n, faction, fsrc, st["combat"], st["leadership"], st["intellect"], st["politics"], debut, death, city])

os.makedirs("lib", exist_ok=True)
with open("lib/roster_full.json", "w", encoding="utf-8") as f:
    json.dump(roster, f, ensure_ascii=False, indent=1)

rev = pd.DataFrame(review_rows, columns=["이름", "국가", "분류근거", "전투", "통솔", "지략", "정치", "활동시작", "활동끝", "연고"])
rev.to_csv("docs/로스터_검수용.csv", index=False, encoding="utf-8-sig")

print(f"\n로스터 생성: {len(roster)}명 → lib/roster_full.json")
print(f"연도 폴백(기본값 190~230) 사용: {missing_years}명")
print("국가 분포:", rev["국가"].value_counts().to_dict())
print("분류 근거:", rev["분류근거"].str[:2].value_counts().to_dict())

# 유명 장수 스팟 체크
for check in ["여포", "관우", "제갈량", "조조", "주유", "장비", "사마의", "육손", "황개", "안량"]:
    r = next((x for x in roster if x["name"] == check), None)
    if r:
        b = r["base"]
        print(f'  {check}: {r["faction"]} 전{b["combat"]} 통{b["leadership"]} 지{b["intellect"]} 정{b["politics"]} {r["activeFrom"]}~{r["activeTo"]} 연고:{r["homeCity"]} 라이벌:{r["rivals"]}')
    else:
        print(f"  {check}: 누락!")
