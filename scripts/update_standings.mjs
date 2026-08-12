import fs from "node:fs/promises";

const SEASON = new Date().getFullYear();
const API = "https://statsapi.mlb.com/api/v1/standings";

async function fetchStandings() {
  const url = new URL(API);
  url.searchParams.set("leagueId", "104");
  url.searchParams.set("season", String(SEASON));
  url.searchParams.set("standingsTypes", "regularSeason");
  url.searchParams.set("hydrate", "team,division,league");

  const res = await fetch(url, {
    headers: { "User-Agent": "Phillies-Website/1.0" }
  });

  if (!res.ok) {
    throw new Error(`MLB Stats API: HTTP ${res.status}`);
  }

  return res.json();
}

function records(data) {
  return (data.records || []).flatMap(record => record.teamRecords || []);
}

function makeTeam(record) {
  const wins = Number(record.wins ?? 0);
  const losses = Number(record.losses ?? 0);
  const games = wins + losses;

  return {
    teamId: record.team?.id ?? null,
    team: record.team?.name ?? "",
    abbreviation: record.team?.abbreviation ?? "",
    division: record.division?.name ?? "",
    divisionId: record.division?.id ?? null,
    league: record.league?.name ?? "National League",
    leagueId: record.league?.id ?? 104,
    divisionRank: Number(record.divisionRank) || null,
    leagueRank: Number(record.leagueRank) || null,
    wildCardRank: Number(record.wildCardRank) || null,
    wins,
    losses,
    gamesPlayed: games,
    winningPercentage:
      record.winningPercentage ??
      (games ? (wins / games).toFixed(3) : ".000"),
    gamesBack: record.gamesBack ?? "-",
    runsScored: Number(record.runsScored ?? 0),
    runsAllowed: Number(record.runsAllowed ?? 0),
    runDifferential:
      Number(record.runsScored ?? 0) -
      Number(record.runsAllowed ?? 0)
  };
}

function rankByDivision(a, b) {
  return (
    (a.divisionRank ?? 999) - (b.divisionRank ?? 999) ||
    b.wins - a.wins
  );
}

function rankByLeague(a, b) {
  return (
    (a.leagueRank ?? 999) - (b.leagueRank ?? 999) ||
    b.wins - a.wins
  );
}

async function main() {
  const data = await fetchStandings();
  const all = records(data).map(makeTeam);

  const nl = all.filter(team => team.leagueId === 104);

  if (nl.length !== 15) {
    throw new Error(
      `National League team count error: expected 15, got ${nl.length}`
    );
  }

  const east = nl
    .filter(team =>
      team.division === "National League East" ||
      team.division === "NL East"
    )
    .sort(rankByDivision);

  if (east.length !== 5) {
    throw new Error(
      `NL East team count error: expected 5, got ${east.length}`
    );
  }

  const divisionWinners = nl
    .filter(team => team.divisionRank === 1)
    .map(team => team.teamId);

  if (divisionWinners.length !== 3) {
    throw new Error(
      `NL division leader count error: expected 3, got ${divisionWinners.length}`
    );
  }

  const divisionWinnerSet = new Set(divisionWinners);

  const wildCardTeams = nl
    .filter(team => !divisionWinnerSet.has(team.teamId))
    .sort(rankByLeague)
    .slice(0, 3);

  if (wildCardTeams.length !== 3) {
    throw new Error(
      `NL Wild Card count error: expected 3, got ${wildCardTeams.length}`
    );
  }

  const wildCardSet = new Set(
    wildCardTeams.map(team => team.teamId)
  );

  const eastTeams = east.map(team => ({
    ...team,
    postseason:
      team.divisionRank === 1
        ? "division"
        : wildCardSet.has(team.teamId)
          ? "wildcard"
          : null
  }));

  const nlTeams = [...nl]
    .sort(rankByLeague)
    .map(team => ({
      ...team,
      postseason:
        divisionWinnerSet.has(team.teamId)
          ? "division"
          : wildCardSet.has(team.teamId)
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
      id: eastTeams[0].divisionId,
      name: "National League East",
      teams: eastTeams
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
    `Saved: NL=${nlTeams.length}, NL East=${eastTeams.length}, Wild Card=${wildCardTeams.length}`
  );
}

main().catch(error => {
  console.error("UPDATE FAILED:", error);
  process.exit(1);
});
