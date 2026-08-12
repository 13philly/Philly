import json,time
from pathlib import Path
from datetime import datetime,timezone,timedelta
from urllib.request import Request,urlopen

A="https://statsapi.mlb.com/api/v1";T=143;F=Path("data/live-mlb-data.json")

def g(u):
 for i in range(3):
  try:
   with urlopen(Request(u,headers={"User-Agent":"PhilliesData"}),timeout=20)as r:return json.load(r)
  except:
   if i==2:raise
   time.sleep(1)

def n(x):
 try:return float(x) if "." in str(x) else int(x)
 except:return 0

def main():
 now=datetime.now(timezone.utc);a=(now-timedelta(days=1)).strftime("%Y-%m-%d");b=(now+timedelta(days=1)).strftime("%Y-%m-%d")
 d=g(f"{A}/schedule?sportId=1&teamId={T}&startDate={a}&endDate={b}&hydrate=linescore")
 gs=[x for z in d.get("dates",[]) for x in z.get("games",[])]
 if not gs:return

 gs.sort(key=lambda x:x.get("gameDate",""))
 g0=max((x for x in gs if x.get("gameDate","")<=now.isoformat()),key=lambda x:x["gameDate"],default=gs[0])
 gid=g0["gamePk"];st=g0.get("status",{}).get("abstractGameState")
 old=json.loads(F.read_text()) if F.exists() else {}

 if st not in ("Live","Final"):
  if old:return
  return

 x=g(f"{A}/game/{gid}/feed/live");ld=x.get("liveData",{});bs=ld.get("boxscore",{});ls=ld.get("linescore",{});ps=ld.get("plays",[])
 side="home" if g0["teams"]["home"]["team"]["id"]==T else "away";other="away" if side=="home" else "home"
 t=g0["teams"][side];o=g0["teams"][other];bt=bs.get("teams",{}).get(side,{})
 inn=[{"n":i.get("num"),"p":[n(i.get(side,{}).get("runs",0)),n(i.get(other,{}).get("runs",0))]} for i in ls.get("innings",[])]
 bat=[{"o":int(v["battingOrder"]),"id":v["person"]["id"],"n":v["person"]["fullName"]} for v in bt.get("players",{}).values() if v.get("battingOrder")]
 bat.sort(key=lambda x:(x["o"],x["id"]))
 pit=[]
 for v in bt.get("players",{}).values():
  if v.get("position",{}).get("abbreviation")!="P":continue
  q=v.get("stats",{}).get("pitching",{})
  if not q:continue
  pit.append({"id":v["person"]["id"],"n":v["person"]["fullName"],"IP":q.get("inningsPitched","0.0"),"H":n(q.get("hits",0)),"BB":n(q.get("baseOnBalls",0)),"K":n(q.get("strikeOuts",0)),"ER":n(q.get("earnedRuns",0))})
 plays=[{"i":p.get("about",{}).get("inning"),"h":p.get("about",{}).get("halfInning"),"b":p.get("matchup",{}).get("batter",{}).get("fullName"),"p":p.get("matchup",{}).get("pitcher",{}).get("fullName"),"o":p.get("about",{}).get("outs"),"r":p.get("result",{}).get("description",""),"RBI":p.get("result",{}).get("rbi",0)} for p in ps if p.get("about",{}).get("isComplete")]

 out={"id":gid,"d":g0.get("gameDate"),"v":g0.get("venue",{}).get("name",""),"opp":o["team"]["name"],"ha":"H" if side=="home" else "A","status":g0.get("status",{}).get("detailedState"),"score":[n(t.get("score",0)),n(o.get("score",0))],"inning":ls.get("currentInning"),"half":ls.get("inningHalf"),"outs":ls.get("outs"),"runners":ls.get("offense",{}),"innings":inn,"bat":bat,"pit":pit,"plays":plays}
 F.parent.mkdir(exist_ok=True);F.write_text(json.dumps(out,ensure_ascii=False,separators=(",",":")))

if __name__=="__main__":main()
