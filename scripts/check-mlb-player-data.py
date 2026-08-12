import json
from datetime import datetime
from urllib.parse import urlencode
from urllib.request import urlopen

API="https://statsapi.mlb.com/api/v1"
YEAR=datetime.now().year

PLAYERS={
    "Alec Bohm":{"id":664761,"group":"hitting"},
    "Aaron Nola":{"id":605400,"group":"pitching"}
}

TYPES=[
    "season",
    "seasonAdvanced",
    "sabermetrics",
    "expectedStatistics",
    "outsAboveAverage"
]

TARGETS={
    "Alec Bohm":["WAR","wOBA","wRC+","OPS","DRS","OAA"],
    "Aaron Nola":["WAR","FIP","xFIP","SIERA","K%","BB%"]
}

def get(path,params):
    try:
        q=urlencode(params)
        with urlopen(f"{API}/{path}?{q}",timeout=30) as r:
            return json.load(r)
    except Exception as e:
        return {"_error":str(e)}

def flatten(x,p=""):
    out={}
    if isinstance(x,dict):
        for k,v in x.items():
            n=f"{p}.{k}" if p else k
            out.update(flatten(v,n))
    elif isinstance(x,list):
        for i,v in enumerate(x):
            out.update(flatten(v,f"{p}[{i}]"))
    else:
        out[p]=x
    return out

def find_values(x):
    found={}
    for k,v in flatten(x).items():
        key=k.split(".")[-1]
        found[key]=v
    return found

def extract_stats(x):
    try:
        return x["stats"][0]["splits"][0]["stat"]
    except:
        return {}

meta={}
for m in ["statTypes","statGroups","metrics"]:
    meta[m]=get(f"meta/{m}",{})

result={
    "season":YEAR,
    "players":{},
    "meta":meta
}

for name,p in PLAYERS.items():
    pdata={
        "id":p["id"],
        "group":p["group"],
        "stats":{},
        "targets":{}
    }

    merged={}

    for typ in TYPES:
        data=get(
            "stats",
            {
                "stats":typ,
                "group":p["group"],
                "season":YEAR,
                "personId":p["id"],
                "limit":100
            }
        )

        stat=extract_stats(data)

        pdata["stats"][typ]=stat

        for k,v in stat.items():
            merged[k]=v

        if "_error" in data:
            pdata["stats"][typ]={"_error":data["_error"]}

    for target in TARGETS[name]:
        matches={
            k:v for k,v in merged.items()
            if k.lower()==target.lower()
            or target.lower().replace("%","pct")==k.lower()
            or target.lower().replace("+","plus")==k.lower()
        }

        pdata["targets"][target]={
            "value":next(iter(matches.values()),None),
            "api_keys":list(matches.keys())
        }

    result["players"][name]=pdata

with open(
    "check-mlb-player-data.json",
    "w",
    encoding="utf-8"
) as f:
    json.dump(
        result,
        f,
        ensure_ascii=False,
        separators=(",",":")
    )
