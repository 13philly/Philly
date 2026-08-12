import json
from urllib.request import urlopen

A="https://statsapi.mlb.com/api/v1";Y=2026
P={"Aaron Nola":605400,"Alec Bohm":664761}

def g(u):
    with urlopen(u,timeout=30) as r:return json.load(r)

def s(i,t,x):
    d=g(f"{A}/people/{i}/stats?stats={t}&season={Y}&group={x}")
    return d.get("stats",[])

O={"season":Y,"players":{}}

for n,i in P.items():
    O["players"][n]={
        "id":i,
        "profile":g(f"{A}/people/{i}"),
        "hitting":{
            "season":s(i,"season","hitting"),
            "advanced":s(i,"seasonAdvanced","hitting")
        },
        "pitching":{
            "season":s(i,"season","pitching"),
            "advanced":s(i,"seasonAdvanced","pitching")
        },
        "fielding":{
            "season":s(i,"season","fielding"),
            "advanced":s(i,"seasonAdvanced","fielding")
        }
    }

with open("check-mlb-player-data.json","w",encoding="utf-8") as f:
    json.dump(O,f,ensure_ascii=False,separators=(",",":"))
