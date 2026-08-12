import json,subprocess,sys
from datetime import datetime,timezone
from pathlib import Path
import requests

TEAM_ID=143
SEASON=datetime.now().year
OUT=Path("data/check-mlb-roster.json")
BASE=f"https://statsapi.mlb.com/api/v1/teams/{TEAM_ID}/roster"

def roster(t):
    r=requests.get(BASE,params={"rosterType":t,"season":SEASON},timeout=30)
    r.raise_for_status()
    return r.json().get("roster",[])

def val(row,*keys):
    for k in keys:
        if k in row and row[k] is not None:
            try:
                if row[k]!=row[k]: continue
            except: pass
            try:return row[k].item()
            except:return row[k]
    return None

try:
    from pybaseball import batting_stats,pitching_stats,statcast_batter_percentile_ranks,statcast_pitcher_percentile_ranks
except ImportError:
    subprocess.check_call([sys.executable,"-m","pip","install","pybaseball"])
    from pybaseball import batting_stats,pitching_stats,statcast_batter_percentile_ranks,statcast_pitcher_percentile_ranks

r40=roster("40Man")
active={x["person"]["id"] for x in roster("active")}
players=[]

for x in r40:
    p=x["person"]; pid=p["id"]; il=False
    try:
        q=requests.get(f"https://statsapi.mlb.com/api/v1/people/{pid}",params={"hydrate":"rosterEntries"},timeout=30).json()["people"][0]
        il=any(
            str(e.get("status",{}).get("code","")).upper() in {"IL","10DIL","15DIL","60DIL"}
            or "injured list" in str(e.get("status",{}).get("description","")).lower()
            for e in q.get("rosterEntries",[])
        )
    except: pass

    info={}
    try:
        q=requests.get(f"https://statsapi.mlb.com/api/v1/people/{pid}",timeout=30).json()["people"][0]
        b=q.get("birthDate"); age=None
        if b:
            d=datetime.strptime(b,"%Y-%m-%d").date(); t=datetime.now().date()
            age=t.year-d.year-((t.month,t.day)<(d.month,d.day))
        pos=q.get("primaryPosition",{}).get("abbreviation")
        if pos not in {"P","C","1B","2B","3B","SS","LF","CF","RF"}: pos=x.get("position",{}).get("abbreviation")
        bat=q.get("batSide",{}).get("code"); throw=q.get("pitchHand",{}).get("code")
        info={"name":q.get("fullName"),"number":q.get("primaryNumber") or x.get("jerseyNumber"),"position":pos,"B/T":f"{bat}/{throw}" if bat and throw else None,"height":q.get("height"),"weight":q.get("weight"),"birthDate":b,"age":age,"birthCountry":q.get("birthCountry")}
    except:
        info={"name":p.get("fullName"),"number":x.get("jerseyNumber"),"position":x.get("position",{}).get("abbreviation"),"B/T":None,"height":None,"weight":None,"birthDate":None,"age":None,"birthCountry":None}

    players.append({"id":pid,"rosterClass":"IL" if il else "ACTIVE" if pid in active else "40-MAN","is40Man":True,"isActive":pid in active,"isIL":il,"bio":info})

try:b=batting_stats(SEASON,SEASON,qual=0)
except:b=None
try:p=pitching_stats(SEASON,SEASON,qual=0)
except:p=None
try:bp=statcast_batter_percentile_ranks(SEASON)
except:bp=None
try:pp=statcast_pitcher_percentile_ranks(SEASON)
except:pp=None

def row(df,pid):
    if df is None:return None
    for c in ("MLBAMID","player_id","mlb_id"):
        if c in df.columns:
            z=df[df[c]==pid]
            if not z.empty:return z.iloc[0]

for x in players:
    pid=x["id"]; br=row(b,pid); pr=row(p,pid); bs=row(bp,pid); ps=row(pp,pid)
    x["batting"]={k:val(br,*v) if br is not None else None for k,v in {
        "G":("G",),"PA":("PA",),"H":("H",),"HR":("HR",),"RBI":("RBI",),
        "AVG":("AVG",),"OPS":("OPS",),"BABIP":("BABIP",),"fWAR":("WAR",),
        "wRC+":("wRC+",),"wOBA":("wOBA",),"DRS":("DRS",),
        "OAA":("OAA","oaa")}.items()}
    x["pitching"]={k:val(pr,*v) if pr is not None else None for k,v in {
        "G":("G",),"IP":("IP",),"HR":("HR",),"BB":("BB",),"K":("SO","K"),
        "fWAR":("WAR",),"FIP":("FIP",),"xFIP":("xFIP",),
        "K-BB%":("K-BB%",),"ERA":("ERA",)}.items()}
    w=val(pr,"W") if pr is not None else None;l=val(pr,"L") if pr is not None else None
    x["pitching"]["W-L"]=f"{w}-{l}" if w is not None and l is not None else None
    x["pitching"]["Whiff%"]=val(ps,"whiff_percent","Whiff%") if ps is not None else None

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps({"team":"Philadelphia Phillies","teamId":TEAM_ID,"season":SEASON,"updatedAt":datetime.now(timezone.utc).isoformat(),"count":len(players),"players":players},ensure_ascii=False,indent=2),encoding="utf-8")
