# -*- coding: utf-8 -*-
# 삼국지2 "시나리오 별 정리" 시트 → 시나리오별 장수 데이터 JSON 추출
# 12블록 = 6시나리오 × (재직 / 후출현·재야)
import json, re, sys
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

df = pd.read_excel("삼국지2 장수 능력표.xlsx", sheet_name="시나리오 별 정리")
df.columns = [str(c).strip() for c in df.columns]

starts = df.index[df["번호"] == 1].tolist() + [len(df)]
blocks = [(starts[i], starts[i + 1]) for i in range(len(starts) - 1)]
assert len(blocks) == 12, f"블록 수 이상: {len(blocks)}"

def clean_name(x):
    # "유표1" → "유표", "유요 (유엽)" → "유요"
    s = str(x).strip()
    s = re.sub(r"\s*\(.*\)$", "", s)
    s = re.sub(r"[0-9]+$", "", s)
    return s

def row_to_general(r, active=True):
    g = {
        "name": clean_name(r["이름"]),
        "rawName": str(r["이름"]).strip(),
        "int": int(r["지력"]),
        "war": int(r["무력"]),
        "chr": int(r["매력"]),
        "birth": int(r["생년"]) if pd.notna(r["생년"]) else None,
        "loyalty_trait": int(r["의리"]) if pd.notna(r["의리"]) else 50,  # 의리
        "virtue": int(r["인덕"]) if pd.notna(r["인덕"]) else 50,  # 인덕
        "ambition": int(r["야망"]) if pd.notna(r["야망"]) else 50,  # 야망
        "compat": int(r["상성"]) if pd.notna(r["상성"]) else 50,  # 상성
        "blood": int(r["혈연"]) if pd.notna(r["혈연"]) else 0,  # 혈연 그룹
        "parent": clean_name(r["부모 이름"]) if pd.notna(r["부모 이름"]) else None,
    }
    if not active:
        g["appearYear"] = int(r["출현 연도"]) if pd.notna(r["출현 연도"]) else None
        g["appearCity"] = int(r["출현 지역"]) if pd.notna(r["출현 지역"]) else None
    return g

scenarios = []
for si in range(6):
    act_s, act_e = blocks[si * 2]
    fut_s, fut_e = blocks[si * 2 + 1]
    active = [row_to_general(df.iloc[i], True) for i in range(act_s, act_e)]
    future = [row_to_general(df.iloc[i], False) for i in range(fut_s, fut_e)]
    scenarios.append({"scenario": si + 1, "active": active, "future": future})
    print(f"S{si+1}: 재직 {len(active)}명 (첫: {active[0]['name']}), 재야/후출현 {len(future)}명")

with open("lib/s2_scenarios.json", "w", encoding="utf-8") as f:
    json.dump(scenarios, f, ensure_ascii=False, indent=1)
print("저장: lib/s2_scenarios.json")
