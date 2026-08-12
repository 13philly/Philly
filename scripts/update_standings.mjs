import fs from "node:fs/promises";

const SEASON = new Date().getFullYear();
const API = "https://statsapi.mlb.com/api/v1/standings";

async function getStandings() {
  const url = new URL(API);
  url.searchParams.set("leagueId", "104");
  url.searchParams.set("season", SEASON);
  url.searchParams.set("standingsTypes", "regularSeason");
  url.searchParams.set("hydrate", "team,division,league");

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`MLB Stats API HTTP ${res.status}`);
  }

  const json = await res.json();

  if (!Array.isArray(json.records)) {
    throw new Error("Invalid MLB Stats API response: records missing");
  }

  return json;
}

function getTeams(data) {
  return data.records.flatMap(record =>
    (record.teamRecords || []).map(team => ({
      ...team,
      divisionInfo: record.division || null,
      leagueInfo: record.league || null
    }))
  );
}

function makeTeam(x) {
  const wins = Number(x.wins ?? 0);
  const losses = Number(x.losses ?? 0);

  return {
    teamId: x.team?.id ?? null,
    team: x.team?.name ?? "",
    abbreviation: x.team?.abbreviation ?? "",
    wins,
    losses,
    winningPercentage: x.winningPercentage ?? ".000",
    gamesBack: x.gamesBack ?? "-",
    divisionRank: Number(x.divisionRank) || null,
    leagueRank: Number(x.leagueRank) || null,
    wildCardRank: Number(x.wildCardRank) || null,
    magicNumber: x.magicNumber ?? null,
    wildCardGamesBack: x.wildCardGamesBack ?? null,
    divisionRecord: x.divisionRecord
      ? {
          wins: Number(x.divisionRecord.wins ?? 0),
          losses: Number(x.divisionRecord.losses ?? 0),
          pct: x.divisionRecord.pct ?? ".000"
        }
      : null,
    leagueRecord: x.leagueRecord
      ? {
          wins: Number(x.leagueRecord.wins ?? 0),
          losses: Number(x.leagueRecord.losses ?? 0),
          pct: x.leagueRecord.pct ?? ".000"
        }
      : null,
    lastTen: x.records?.splitRecords?.find(
      r => r.type === "lastTen"
    ) || null,
    streak: x.streak ?? null,
    runsScored: Number(x.runsScored ?? 0),
    runsAllowed: Number(x.runsAllowed ?? 0),
    runDifferential:
      Number(x.runsScored ?? 0) -
      Number(x.runsAllowed ?? 0)
  };
}

function divisionName(x) {
  return (
    x.divisionInfo?.name ||
    x.team?.division?.name ||
    ""
  );
}

function leagueId(x) {
  return (
    Number(x.leagueInfo?.id) ||
    Number(x.team?.league?.id) ||
    null
  );
}

function divisionId(x) {
  return (
    Number(x.divisionInfo?.id) ||
    Number(x.team?.division?.id) ||
    null
  );
}

function sortDivision(a, b) {
  return (
    (a.divisionRank ?? 999) -
      (b.divisionRank ?? 999) ||
    Number(b.winningPercentage) -
      Number(a.winningPercentage) ||
    b.wins - a.wins
  );
}

function sortLeague(a, b) {
  return (
    (a.leagueRank ?? 999) -
      (b.leagueRank ?? 999) ||
    Number(b.winningPercentage) -
      Number(a.winningPercentage) ||
    b.wins - a.wins
  );
}

async function main() {
  const data = await getStandings();
  const rawTeams = getTeams(data);

  if (!rawTeams.length) {
    throw new Error("MLB Stats API returned zero teams");
  }

  const nlRaw = rawTeams.filter(x => leagueId(x) === 104);

  if (nlRaw.length !== 15) {
    throw new Error(
      `National League count error: ${nlRaw.length}`
    );
  }

  const eastRaw = nlRaw.filter(x => {
    const name = divisionName(x).toLowerCase();
    return name.includes("national league east") ||
           name === "nl east";
  });

  if (eastRaw.length !== 5) {
    throw new Error(
      `NL East count error: ${eastRaw.length}`
    );
  }

  const nl = nlRaw.map(makeTeam);
  const east = eastRaw.map(makeTeam).sort(sortDivision);

  const divisionLeaders = new Set(
    nl
      .filter(x => x.divisionRank === 1)
      .map(x => x.teamId)
  );

  if (divisionLeaders.size !== 3) {
    throw new Error(
      `NL division leader count error: ${divisionLeaders.size}`
    );
  }

  const wildCards = nl
    .filter(x => !divisionLeaders.has(x.teamId))
    .sort(sortLeague)
    .slice(0, 3);

  if (wildCards.length !== 3) {
    throw new Error(
      `NL Wild Card count error: ${wildCards.length}`
    );
  }

  const wildCardIds = new Set(
    wildCards.map(x => x.teamId)
  );

  const divisionTeams = east.map(x => ({
    ...x,
    postseason:
      divisionLeaders.has(x.teamId)
        ? "division"
        : wildCardIds.has(x.teamId)
          ? "wildcard"
          : null
  }));

  const nlTeams = nl
    .sort(sortLeague)
    .map(x => ({
      ...x,
      postseason:
        divisionLeaders.has(x.teamId)
          ? "division"
          : wildCardIds.has(x.teamId)
            ? "wildcard"
            : null
    }));

  const output = {
    season: SEASON,
    league: {
      id: 104,
      name: "National League"
    },
    division: {
      id: divisionId(eastRaw[0]),
      name: "National League East",
      teams: divisionTeams
    },
    wildCard: {
      league: "National League",
      teams: nlTeams
    },
    updatedAt: new Date().toISOString()
  };

  await fs.mkdir("data", { recursive: true });

  await fs.writeFile(
    "data/standings.json",
    JSON.stringify(output, null, 2),
    "utf8"
  );

  console.log(
    `SUCCESS: NL=${nl.length}, NL East=${east.length}, Wild Card=3`
  );
}

main().catch(error => {
  console.error("UPDATE FAILED");
  console.error(error.stack || error);
  process.exit(1);
});
