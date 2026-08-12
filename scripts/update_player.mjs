const TEAM_ID = 143;
const SEASON = new Date().getFullYear();
const API = "https://statsapi.mlb.com/api/v1";

import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT = path.join(
  process.cwd(),
  "data",
  "players.json"
);

async function getJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `MLB API ${response.status}: ${url}`
    );
  }

  return response.json();
}

function statFor(groups, groupName, typeName) {
  const target = String(typeName).toLowerCase();

  const item = (groups || []).find(group => {
    const groupValue = String(
      group?.group?.displayName ??
      group?.group?.name ??
      ""
    ).toLowerCase();

    const typeValue = String(
      group?.type?.displayName ??
      group?.type?.name ??
      ""
    ).toLowerCase();

    return (
      groupValue === groupName &&
      typeValue === target
    );
  });

  return item?.splits?.[0]?.stat ?? {};
}

function first(stat, keys) {
  for (const key of keys) {
    if (
      stat &&
      stat[key] !== undefined &&
      stat[key] !== null
    ) {
      return stat[key];
    }
  }

  return null;
}

function rosterStatus(entry) {
  const status = entry?.status;

  return {
    code: status?.code ?? null,
    type: status?.type ?? null,
    description: status?.description ?? null
  };
}

function buildHitting(
  season,
  advanced,
  sabermetrics
) {
  return {
    season: {
      gamesPlayed: season.gamesPlayed ?? null,
      plateAppearances:
        season.plateAppearances ?? null,
      atBats: season.atBats ?? null,
      runs: season.runs ?? null,
      hits: season.hits ?? null,
      doubles: season.doubles ?? null,
      triples: season.triples ?? null,
      homeRuns: season.homeRuns ?? null,
      rbi: season.rbi ?? null,
      baseOnBalls:
        season.baseOnBalls ?? null,
      strikeOuts:
        season.strikeOuts ?? null,
      stolenBases:
        season.stolenBases ?? null,
      caughtStealing:
        season.caughtStealing ?? null,
      avg: season.avg ?? null,
      obp: season.obp ?? null,
      slg: season.slg ?? null,
      ops: season.ops ?? null,
      babip: season.babip ?? null,
      totalBases:
        season.totalBases ?? null
    },

    advanced: {
      iso: advanced.iso ?? null,
      pitchesPerPlateAppearance:
        advanced.pitchesPerPlateAppearance ?? null,
      walksPerPlateAppearance:
        advanced.walksPerPlateAppearance ?? null,
      strikeoutsPerPlateAppearance:
        advanced.strikeoutsPerPlateAppearance ?? null,
      homeRunsPerPlateAppearance:
        advanced.homeRunsPerPlateAppearance ?? null
    },

    sabermetrics: {
      war: first(sabermetrics, ["war"]),
      wpa: first(sabermetrics, ["wpa"]),
      wpaMinus:
        first(sabermetrics, ["wpaMinus"]),
      wpaPlus:
        first(sabermetrics, ["wpaPlus"]),
      re24: first(sabermetrics, ["re24"]),
      wrcPlus:
        first(sabermetrics, ["wrcPlus"]),
      wraa:
        first(sabermetrics, ["wraa"]),
      woba:
        first(sabermetrics, ["woba"])
    }
  };
}

function buildPitching(
  season,
  advanced,
  sabermetrics
) {
  return {
    season: {
      gamesPlayed:
        season.gamesPlayed ?? null,
      gamesStarted:
        season.gamesStarted ?? null,
      wins: season.wins ?? null,
      losses: season.losses ?? null,
      saves: season.saves ?? null,
      holds: season.holds ?? null,
      inningsPitched:
        season.inningsPitched ?? null,
      hits: season.hits ?? null,
      runs: season.runs ?? null,
      earnedRuns:
        season.earnedRuns ?? null,
      homeRuns:
        season.homeRuns ?? null,
      baseOnBalls:
        season.baseOnBalls ?? null,
      strikeOuts:
        season.strikeOuts ?? null,
      era: season.era ?? null,
      whip: season.whip ?? null
    },

    advanced: {
      strikeoutsPer9Inn:
        advanced.strikeoutsPer9Inn ?? null,
      walksPer9Inn:
        advanced.walksPer9Inn ?? null,
      hitsPer9Inn:
        advanced.hitsPer9Inn ?? null,
      homeRunsPer9:
        advanced.homeRunsPer9 ?? null,
      strikeoutWalkRatio:
        advanced.strikeoutWalkRatio ?? null,
      strikePercentage:
        advanced.strikePercentage ?? null
    },

    sabermetrics: {
      war: first(sabermetrics, ["war"]),

      fip: first(sabermetrics, ["fip"]),

      xfip: first(sabermetrics, ["xfip"]),

      "k-bb%": first(
        sabermetrics,
        [
          "k-bb%",
          "kBB%",
          "kbb%",
          "kBBPct",
          "kBbPct",
          "kBBPercent",
          "kbbPercent"
        ]
      ),

      wpa: first(
        sabermetrics,
        ["wpa"]
      ),

      re24: first(
        sabermetrics,
        ["re24"]
      )
    }
  };
}

async function main() {
  console.log(
    `Updating Phillies players for ${SEASON}`
  );

  /*
   * ロスター判定
   * ここは40-man roster方式。
   */
  const rosterURL =
    `${API}/teams/${TEAM_ID}/roster` +
    `?rosterType=40Man&season=${SEASON}`;

  const rosterData =
    await getJSON(rosterURL);

  const roster =
    rosterData?.roster ?? [];

  if (!roster.length) {
    throw new Error(
      "40-man roster returned no players"
    );
  }

  const players = [];

  for (const entry of roster) {
    const personId =
      entry?.person?.id;

    if (!personId) continue;

    try {
      /*
       * 基本情報
       * MLB people endpointを使用。
       */
      const personURL =
        `${API}/people/${personId}` +
        `?season=${SEASON}` +
        `&hydrate=stats(` +
        `group=[hitting,pitching],` +
        `type=[season,seasonAdvanced,sabermetrics],` +
        `season=${SEASON}` +
        `)`;

      const data =
        await getJSON(personURL);

      const person =
        data?.people?.[0];

      if (!person) continue;

      /*
       * 成績
       *
       * group と type を完全一致させる。
       */
      const groups =
        person?.stats ?? [];

      const hittingSeason =
        statFor(
          groups,
          "hitting",
          "season"
        );

      const hittingAdvanced =
        statFor(
          groups,
          "hitting",
          "seasonadvanced"
        );

      const hittingSabermetrics =
        statFor(
          groups,
          "hitting",
          "sabermetrics"
        );

      const pitchingSeason =
        statFor(
          groups,
          "pitching",
          "season"
        );

      const pitchingAdvanced =
        statFor(
          groups,
          "pitching",
          "seasonadvanced"
        );

      const pitchingSabermetrics =
        statFor(
          groups,
          "pitching",
          "sabermetrics"
        );

      const pitcher =
        person?.primaryPosition
          ?.abbreviation === "P";

      /*
       * 基本情報はpeopleレスポンス。
       */
      const player = {
        id: person.id,

        name:
          person.fullName ?? null,

        firstName:
          person.firstName ?? null,

        lastName:
          person.lastName ?? null,

        number:
          person.primaryNumber ??
          entry.jerseyNumber ??
          null,

        position: {
          code:
            person.primaryPosition
              ?.code ?? null,

          name:
            person.primaryPosition
              ?.name ?? null,

          abbreviation:
            person.primaryPosition
              ?.abbreviation ?? null
        },

        bt: {
          bats:
            person.batSide?.code ??
            null,

          throws:
            person.pitchHand?.code ??
            null
        },

        physical: {
          height:
            person.height ?? null,

          weight:
            person.weight ?? null,

          birthDate:
            person.birthDate ?? null,

          birthCity:
            person.birthCity ?? null,

          birthCountry:
            person.birthCountry ?? null
        },

        roster: {
          status:
            rosterStatus(entry),

          rosterType:
            "40-MAN",

          fortyMan: true
        },

        stats: pitcher
          ? {
              type: "pitcher",

              pitching:
                buildPitching(
                  pitchingSeason,
                  pitchingAdvanced,
                  pitchingSabermetrics
                ),

              hitting: null
            }
          : {
              type: "hitter",

              hitting:
                buildHitting(
                  hittingSeason,
                  hittingAdvanced,
                  hittingSabermetrics
                ),

              pitching: null
            },

        updatedAt:
          new Date().toISOString()
      };

      players.push(player);

      console.log(
        `${player.name}: ${pitcher ? "P" : "H"}`
      );

    } catch (error) {
      /*
       * 1人の失敗で全選手データを
       * 失わせない。
       */
      console.error(
        `Player ${personId} failed:`,
        error.message
      );
    }
  }

  if (!players.length) {
    throw new Error(
      "No player data collected"
    );
  }

  const output = {
    team: {
      id: TEAM_ID,
      name:
        "Philadelphia Phillies"
    },

    season: SEASON,

    source:
      "MLB Stats API",

    updatedAt:
      new Date().toISOString(),

    players
  };

  await fs.mkdir(
    path.dirname(OUTPUT),
    {
      recursive: true
    }
  );

  await fs.writeFile(
    OUTPUT,
    JSON.stringify(
      output,
      null,
      2
    ),
    "utf8"
  );

  console.log(
    `Saved ${players.length} players`
  );
  console.log(
    `Output: ${OUTPUT}`
  );
}

main().catch(error => {
  console.error(
    "UPDATE FAILED:",
    error
  );

  process.exit(1);
});
