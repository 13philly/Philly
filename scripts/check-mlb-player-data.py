import json
from urllib.request import urlopen
from urllib.parse import urlencode

A="https://statsapi.mlb.com/api/v1"
Y=2026
P={"Alec Bohm":664761,"Aaron Nola":605400}
B=["WAR","wOBA","wRC+","OPS","DRS","OAA"]
T=["WAR","FIP","xFIP","SIERA","K%","BB%"]

def g(path,params={}):
    try:
        q=urlencode(params)
        with urlopen(f"{A}/{path}?{q}",timeout=30) as r:return json.load(r)
    except Exception as e:return {"error":str(e)}

m=g("meta/metrics")
O={"season":Y,"metrics":m,"players":{}}

for n,i in P.items():
    target=B if n=="Alec Bohm" else T
    r=g("stats",{
        "stats":"season",
        "group":"hitting" if n=="Alec Bohm" else "pitching",
        "season":Y,
        "personId":i,
        "limit":100
    })
    a=r.get("stats",[])
    raw=a[0].get("splits",[{}])[0].get("stat",{}) if a else {}
    O["players"][n]={
        "id":i,
        "available_metrics":{
            x:raw.get(x) if x in raw else None
            for x in target
        },
        "raw":raw
    }

with open("check-mlb-player-data.json","w",encoding="utf-8") as f:
    json.dump(O,f,ensure_ascii=False,separators=(",",":"))
