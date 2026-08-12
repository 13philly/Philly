import json
from urllib.request import urlopen
from urllib.parse import quote

A="https://statsapi.mlb.com/api/v1";Y=2026
P={"Aaron Nola":645261,"Alec Bohm":664761}

def g(u):
    try:
        with urlopen(u,timeout=30) as r:return json.load(r)
    except:return None

def s(i,t,x):
    d=g(f"{A}/people/{i}/stats?stats={t}&season={Y}&group={x}")
    return d.get("stats",[{}])[0].get("splits",[{}])[0].get("stat",{}) if d else {}

O={"season":Y,"players":{}}

for n,i in P.items():
    O["players"][n]={
        "id":i,
        "profile":g(f"{A}/people/{i}"),
        "hitting":{"season":s(i,"season","hitting"),"advanced":s(i,"seasonAdvanced","hitting")},
        "pitching":{"season":s(i,"season","pitching"),"advanced":s(i,"seasonAdvanced","pitching")},
        "fielding":{"season":s(i,"season","fielding"),"advanced":s(i,"seasonAdvanced","fielding")}
    }

open("check-mlb-player-data.json","w",encoding="utf-8").write(json.dumps(O,ensure_ascii=False,separators=(",",":")))
