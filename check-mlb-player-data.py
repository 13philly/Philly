import json
from urllib.request import urlopen
from urllib.parse import quote

A="https://statsapi.mlb.com/api/v1"
Y=2026
N=["Aaron Nola","Alec Bohm"]

def g(u):
    with urlopen(u) as r:return json.load(r)

out={}
for n in N:
    p=g(f"{A}/people/search?names={quote(n)}")["people"][0]
    i=p["id"]
    out[n]={
        "player":g(f"{A}/people/{i}"),
        "hitting":g(f"{A}/people/{i}/stats?stats=season&season={Y}&group=hitting"),
        "pitching":g(f"{A}/people/{i}/stats?stats=season&season={Y}&group=pitching"),
        "fielding":g(f"{A}/people/{i}/stats?stats=season&season={Y}&group=fielding")
    }

open("check-mlb-player-data.json","w",encoding="utf-8").write(json.dumps(out,ensure_ascii=False,indent=2))
