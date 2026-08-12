import json
from datetime import datetime, timezone

import requests

TEAM_ID = 143
SEASON = datetime.now().year
BASE_URL = f"https://statsapi.mlb.com/api/v1/teams/{TEAM_ID}/roster"


def get_roster(roster_type):
    response = requests.get(
        BASE_URL,
        params={
            "rosterType": roster_type,
            "season": SEASON
        },
        timeout=30
    )
    response.raise_for_status()
    return response.json().get("roster", [])


roster_40 = get_roster("40Man")
active = get_roster("active")
il = get_roster("injured")

active_ids = {x["person"]["id"] for x in active}
il_ids = {x["person"]["id"] for x in il}

players = []

for item in roster_40:
    person = item["person"]
    player_id = person["id"]

    is_il = player_id in il_ids
    is_active = player_id in active_ids

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

players.sort(key=lambda x: (
    {"IL": 0, "ACTIVE": 1, "40-MAN": 2}[x["rosterClass"]],
    x["name"] or ""
))

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
) as file:
    json.dump(result, file, ensure_ascii=False, indent=2)

print(f"Roster updated: {len(players)} players")
print(f"Season: {SEASON}")

for player in players:
    print(
        player["rosterClass"],
        "|",
        player["id"],
        "|",
        player["name"]
    )
