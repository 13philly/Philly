import json,requests
from datetime import datetime,timezone
from pathlib import Path

A="https://statsapi.mlb.com/api/v1";T=143;Y=datetime.now().year;O=Path("data/check-mlb-roster.json")
G=lambda u,p={}:requests.get(A+u,params=p,timeout=30).json()
R=lambda t:G(f"/teams/{T}/roster",{"rosterType":t,"season":Y}).get("roster",[])
def S(i,g,t):
 try:return G(f"/people/{i}/stats",{"stats":t,"group":g,"season":Y,"gameType":"R"})["stats"][0]["splits"][0]["stat"]
 except:return {}
def V(*x):
 for d in x:
  if isinstance(d,dict):
   for k in V.K:
    if d.get(k)!=None:return d[k]
V.K=[]

r=R("40Man");a={x["person"]["id"] for x in R("active")};P=[]

for x in r:
 i=x["person"]["id"];p=G(f"/people/{i}",{"hydrate":"rosterEntries"})["people"][0];e=p.get("rosterEntries",[])
 il=any("injured list" in str(z.get("status",{}).get("description","")).lower() or str(z.get("status",{}).get("code","")).upper() in {"IL","10DIL","15DIL","60DIL"} for z in e)
 b=p.get("birthDate");age=None
 if b:
  d=datetime.strptime(b,"%Y-%m-%d").date();n=datetime.now().date();age=n.year-d.year-((n.month,n.day)<(d.month,d.day))
 q=lambda g:[S(i,g,t) for t in ["season","seasonAdvanced","statsSingleSeasonAdvanced"]]
 h,ha,hx=q("hitting");p0,pa,px=q("pitching");f,fa,fx=q("fielding")
 def v(*ds):
  for d in ds:
   for k in V.K:
    if d.get(k)!=None:return d[k]
 pos=p.get("primaryPosition",{}).get("abbreviation")
 V.K=["gamesPlayed"];g=v(h,ha,hx)
 V.K=["plateAppearances"];pa0=v(h,ha,hx)
 V.K=["hits"];hit=v(h,ha,hx)
 V.K=["homeRuns"];hr=v(h,p0)
 V.K=["rbi"];rbi=v(h)
 V.K=["avg"];avg=v(h)
 V.K=["ops"];ops=v(h)
 V.K=["babip"];bab=v(ha,hx)
 V.K=["war"];war=v(ha,hx)
 V.K=["wRC+","wRCPlus"];wrc=v(ha,hx)
 V.K=["wOBA","woba"];woba=v(ha,hx)
 V.K=["defensiveRunsSaved","drs"];drs=v(f,fa,fx)
 V.K=["outsAboveAverage","oaa"];oaa=v(f,fa,fx)
 batting=dict(zip(["G","PA","H","HR","RBI","AVG","OPS","BABIP","WAR","wRC+","wOBA","DRS","OAA"],[g,pa0,hit,hr,rbi,avg,ops,bab,war,wrc,woba,drs,oaa]))
 V.K=["gamesPlayed"];pg=v(p0,pa,px)
 V.K=["inningsPitched"];ip=v(p0,pa,px)
 V.K=["homeRuns"];phr=v(p0,pa,px)
 V.K=["baseOnBalls"];bb=v(p0,pa,px)
 V.K=["strikeOuts"];k=v(p0,pa,px)
 V.K=["war"];pwar=v(pa,px)
 V.K=["fip"];fip=v(pa,px)
 V.K=["xFIP","xFip"];xfip=v(pa,px)
 V.K=["whiffPercent","whiff%"];wh=v(pa,px)
 V.K=["kMinusBbPercent","K-BB%"];kb=v(pa,px)
 V.K=["era"];era=v(p0,pa,px)
 pitching={"G":pg,"IP":ip,"W-L":f'{p0.get("wins")}-{p0.get("losses")}' if p0.get("wins")!=None and p0.get("losses")!=None else None,"HR":phr,"BB":bb,"K":k,"WAR":pwar,"FIP":fip,"xFIP":xfip,"Whiff%":wh,"K-BB%":kb,"ERA":era}
 P.append({"id":i,"rosterClass":"IL" if il else "ACTIVE" if i in a else "40-MAN","is40Man":1,"isActive":i in a,"isIL":il,"bio":{"name":p.get("fullName"),"number":p.get("primaryNumber") or x.get("jerseyNumber"),"position":pos,"B/T":f'{p.get("batSide",{}).get("code")}/{p.get("pitchHand",{}).get("code")}',"height":p.get("height"),"weight":p.get("weight"),"birthDate":b,"age":age,"birthCountry":p.get("birthCountry")},"batting":batting,"pitching":pitching})

O.parent.mkdir(parents=True,exist_ok=True);O.write_text(json.dumps({"team":"Philadelphia Phillies","teamId":T,"season":Y,"updatedAt":datetime.now(timezone.utc).isoformat(),"count":len(P),"players":P},ensure_ascii=False,indent=2),encoding="utf-8")
