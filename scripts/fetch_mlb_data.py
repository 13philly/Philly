import json,time
from pathlib import Path
from datetime import datetime,timezone
from urllib.request import Request,urlopen
from urllib.parse import urlencode

A="https://statsapi.mlb.com/api/v1";T=143;F=Path("data/fetch-mlb-data.json")

def g(p,q={}):
 u=A+p+"?"+urlencode(q)
 for i in range(4):
  try:
   with urlopen(Request(u,headers={"User-Agent":"PhilliesData"}),timeout=30)as r:return json.load(r)
  except:
   if i==3:raise
   time.sleep(2**i)

def n(x):
 try:return float(x) if "." in str(x) else int(x)
 except:return 0

def s(x,k):return n(x.get(k,0))

def pid(k,p):
 return p.get("person",{}).get("id") or (int(k[2:]) if k.startswith("ID") and k[2:].isdigit() else 0)

def name(p):return p.get("person",{}).get("fullName","")

def bat(t):
 r=[]
 for k,p in t.get("players",{}).items():
  o=p.get("battingOrder")
  if not o:continue
  x=p.get("stats",{}).get("batting",{})
  r.append({"o":int(o),"id":pid(k,p),"n":name(p),"PA":s(x,"plateAppearances"),"AB":s(x,"atBats"),"H":s(x,"hits"),"HR":s(x,"homeRuns"),"RBI":s(x,"rbi"),"SO":s(x,"strikeOuts")})
 return sorted(r,key=lambda x:(x["o"],x["id"]))

def pit(t):
 ids=t.get("pitchers",[]);order={int(x):i+1 for i,x in enumerate(ids)};r=[]
 for k,p in t.get("players",{}).items():
  i=pid(k,p)
  if i not in order:continue
  x=p.get("stats",{}).get("pitching",{})
  r.append({"o":order[i],"id":i,"n":name(p),"IP":x.get("inningsPitched","0.0"),"H":s(x,"hits"),"BB":s(x,"baseOnBalls"),"K":s(x,"strikeOuts"),"ER":s(x,"earnedRuns"),"W":s(x,"wins"),"L":s(x,"losses"),"SV":s(x,"saves")})
 return sorted(r,key=lambda x:x["o"])

def main():
 y=datetime.now(timezone.utc).year
 q={"sportId":1,"teamId":T,"season":y,"startDate":f"{y}-01-01","endDate":f"{y}-12-31","gameTypes":"R,F,D,L,W"}
 games={}
 for d in g("/schedule",q).get("dates",[]):
  for x in d.get("games",[]):games[x["gamePk"]]=x
 out={}
 for i,x in sorted(games.items()):
  if x.get("status",{}).get("abstractGameState")!="Final":continue
  b=g(f"/game/{i}/boxscore");time.sleep(.15);l=g(f"/game/{i}/linescore")
  side="home" if x["teams"]["home"]["team"]["id"]==T else "away";other="away" if side=="home" else "home"
  t=x["teams"][side];o=x["teams"][other];tr=n(t.get("score",0));or_=n(o.get("score",0))
  inn=[]
  for z in l.get("innings",[]):
   v=z.get(side,{})
   inn.append([s(v,"runs"),s(v,"hits"),s(v,"errors")])
  out[str(i)]={"s":y,"t":x.get("gameType"),"d":x.get("gameDate","")[:10],"time":x.get("gameDate",""),"v":x.get("venue",{}).get("name",""),"opp":o["team"].get("name",""),"ha":"H" if side=="home" else "A","r":"W" if tr>or_ else "L" if tr<or_ else "T","score":[tr,or_],"innings":inn,"bat":bat(b["teams"][side]),"pit":pit(b["teams"][side])}
 F.parent.mkdir(exist_ok=True)
 F.write_text(json.dumps(out,ensure_ascii=False,separators=(",",":")),encoding="utf-8")

if __name__=="__main__":main()
