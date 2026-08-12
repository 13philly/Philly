import fs from"node:fs/promises";

const YEAR=new Date().getFullYear();
const BASE="https://statsapi.mlb.com/api/v1/standings";

async function get(type){
  const u=new URL(BASE);
  u.searchParams.set("leagueId","104");
  u.searchParams.set("season",YEAR);
  u.searchParams.set("standingsTypes",type);
  u.searchParams.set("hydrate","team,division,league");
  const r=await fetch(u);
  if(!r.ok)throw Error(`MLB API ${r.status}`);
  return r.json();
}

function teams(data){
  return data.records?.flatMap(r=>r.teamRecords||[])||[];
}

function row(x){
  return{
    rank:x.divisionRank?Number(x.divisionRank):null,
    team:x.team?.name||"",
    teamId:x.team?.id||null,
    wins:x.wins??0,
    losses:x.losses??0,
    pct:x.winningPercentage??".000",
    gamesBack:x.gamesBack??"-",
    divisionRank:x.divisionRank?Number(x.divisionRank):null,
    leagueRank:x.leagueRank?Number(x.leagueRank):null,
    wildCardRank:x.wildCardRank?Number(x.wildCardRank):null
  };
}

async function main(){
  const [regular,wildcard]=await Promise.all([
    get("regularSeason"),
    get("wildCard")
  ]);

  const nl=teams(regular);
  const east=nl.filter(x=>x.division?.id===204);

  const wc=teams(wildcard)
    .filter(x=>x.league?.id===104)
    .sort((a,b)=>{
      const ar=Number(a.wildCardRank||999);
      const br=Number(b.wildCardRank||999);
      return ar-br;
    });

  const divisionLeaderIds=new Set(
    nl
      .filter(x=>Number(x.divisionRank)===1)
      .map(x=>x.team?.id)
  );

  const wildCardIds=new Set(
    wc
      .filter(x=>!divisionLeaderIds.has(x.team?.id))
      .slice(0,3)
      .map(x=>x.team?.id)
  );

  const division=east
    .sort((a,b)=>Number(a.divisionRank)-Number(b.divisionRank))
    .map(x=>({
      ...row(x),
      postseason:
        Number(x.divisionRank)===1
          ?"division"
          :wildCardIds.has(x.team?.id)
            ?"wildcard"
            :null
    }));

  const wildCard=wc.map(x=>({
    ...row(x),
    postseason:
      divisionLeaderIds.has(x.team?.id)
        ?"division"
        :wildCardIds.has(x.team?.id)
          ?"wildcard"
          :null
  }));

  const out={
    season:YEAR,
    league:"National League",
    division:{
      name:"NL East",
      teams:division
    },
    wildCard:{
      league:"NL",
      teams:wildCard
    },
    updatedAt:new Date().toISOString()
  };

  await fs.mkdir("data",{recursive:true});
  await fs.writeFile(
    "data/standings.json",
    JSON.stringify(out,null,2),
    "utf8"
  );

  console.log(
    `Saved NL East standings and NL Wild Card data: ${YEAR}`
  );
}

main().catch(e=>{
  console.error("UPDATE FAILED:",e);
  process.exit(1);
});
