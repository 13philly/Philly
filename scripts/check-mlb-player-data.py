import json
from urllib.request import urlopen
from urllib.parse import urlencode

A="https://statsapi.mlb.com/api/v1"
Y=2026
P={"Alec Bohm":664761,"Aaron Nola":605400}
W={
"Alec Bohm":["WAR","wOBA","wRC+","OPS","DRS","OAA"],
"Aaron Nola":["WAR","FIP","xFIP","SIERA","K%","BB%"]
}

def get(path,**p):
    try:
        u=f"{A}/{path}?{urlencode(p)}"
        with urlopen(u,timeout=30) as r:return json.load(r)
    except Exception as e:return {"error":str(e)}

def flat(x):
    if isinstance(x,dict):
        for k,v in x.items():
            yield k,v
            yield from flat(v)
    elif isinstance(x,list):
        for v in x:yield from flat(v)

meta=get("meta/metrics")
metrics={str(k).lower():v for k,v in flat(meta)}

O={"season":Y,"players":{},"metrics_meta":meta}

for name,pid in P.items():
    group="hitting" if name=="Alec Bohm" else "pitching"
    raw=get(
        "stats",
        stats="season",
        group=group,
        season=Y,
        personId=pid,
        limit=100
    )

    adv=get(
        "stats",
        stats="seasonAdvanced",
        group=group,
        season=Y,
        personId=pid,
        limit=100
    )

    def stat(x):
        try:return x["stats"][0]["splits"][0]["stat"]
        except:return {}

    r={**stat(raw),**stat(adv)}

    result={}
    for wanted in W[name]:
        key=next((k for k in r if k.lower()==wanted.lower()),None)
        meta_key=next((k for k in metrics if k==wanted.lower()),None)
        result[wanted]={
            "value":r.get(key) if key else None,
            "api_key":key,
            "metric_exists":meta_key is not None,
            "metric_key":meta_key
        }

    O["players"][name]={
        "id":pid,
        "group":group,
        "requested":result,
        "raw_season":stat(raw),
        "raw_advanced":stat(adv)
    }

with open("check-mlb-player-data.json","w",encoding="utf-8") as f:
    json.dump(O,f,ensure_ascii=False,separators=(",",":"))
