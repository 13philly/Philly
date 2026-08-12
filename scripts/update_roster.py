import json
from datetime import datetime, timezone

import requests

TEAM_ID = 143
SEASON = datetime.now().year
BASE_URL = f"https://statsapi.mlb.com/api/v1/teams/{TEAM_ID}/roster"


def get_roster(roster_type):
    r = requests.get(
        BASE_URL,
        params={"rosterType": roster_type, "season": SEASON},
        timeout=30
    )
    r.raise_for_status()
    return r.json().get("roster", [])


roster_40 = get_roster("40Man")
active_roster = get_roster("active")

active_ids = {
    x["person"]["id"]
    for x in active_roster
}

players = []

for item in roster_40:
    person = item["person"]
    player_id = person["id"]

    is_active = player_id in active_ids

    # 40-Manにいる選手について、
    # Activeでなければ現在のMLB roster statusを個別確認
    is_il = False

    if not is_active:
        r = requests.get(
            f"https://statsapi.mlb.com/api/v1/people/{player_id}",
            params={"hydrate": "currentTeam,rosterEntries"},
            timeout=30
        )
        r.raise_for_status()

        people = r.json().get("people", [])

        if people:
            person_data = people[0]

            for entry in person_data.get("rosterEntries", []):
                status = entry.get("status", {})
                code = str(status.get("code", "")).upper()
                description = str(
                    status.get("description", "")
                ).lower()

                if (
                    code in {"IL", "10DIL", "15DIL", "60DIL"}
                    or "injured list" in description
                    or "injured" in description
                ):
                    is_il = True
                    break

    if is_il:
        roster_class = "IL"
    elif is_active:
        roster_class = "ACTIVE"
    else:
        roster_class = "40-MAN"

    players.append({
        "id": player_id,
        "name": person.get("fullName"),
        "number": item.get("jerseyNumber"),
        "position": item.get("position", {}).get("abbreviation"),
        "is40Man": True,
        "isActive": is_active,
        "isIL": is_il,
        "rosterClass": roster_class
    })


players.sort(
    key=lambda x: (
        {"IL": 0, "ACTIVE": 1, "40-MAN": 2}[x["rosterClass"]],
        x["name"] or ""
    )
)

result = {
    "team": "Philadelphia Phillies",
    "teamId": TEAM_ID,
    "season": SEASON,
    "updatedAt": datetime.now(timezone.utc).isoformat(),
    "count": len(players),
    "players": players
}

with open(
    "data/check-mlb-roster.json",
    "w",
    encoding="utf-8"
) as f:
    json.dump(
        result,
        f,
        ensure_ascii=False,
        indent=2
    )

for p in players:
    print(
        f'{p["rosterClass"]:7} | '
        f'{p["id"]} | '
        f'{p["name"]}'
    )
