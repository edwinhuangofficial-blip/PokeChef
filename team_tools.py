from pokemon_tools import get_pokemon
from type_tools import TYPES, get_multiplier

def analyze_team_types(team_names):
    """Analyze the defensive typing of up to six Pokémon."""

    if not isinstance(team_names, list) or not 1 <= len(team_names) <= 6:
        return {"error": "Provide a list of 1 to 6 Pokémon."}

    team = []

    for name in team_names:
        if not isinstance(name, str) or not name.strip():
            return {"error": "Every Pokémon must have a valid name."}

        pokemon = get_pokemon(name.strip().lower().replace(" ", "-"))

        if "error" in pokemon:
            return {"error": f"Could not find Pokémon: {name}"}

        team.append({
            "name": pokemon["name"],
            "types": pokemon["types"]
        })

    analysis = {}

    # Check all 18 types against every team member
    for attack_type in TYPES:
        weak = []
        resistant = []
        immune = []
        neutral = []

        for pokemon in team:
            multiplier = get_multiplier(attack_type, pokemon["types"])

            entry = {
                "name": pokemon["name"],
                "multiplier": multiplier
            }

            if multiplier == 0:
                immune.append(entry)
            elif multiplier > 1:
                weak.append(entry)
            elif multiplier < 1:
                resistant.append(entry)
            else:
                neutral.append(entry)

        analysis[attack_type] = {
            "weak": weak,
            "resistant": resistant,
            "immune": immune,
            "neutral": neutral,
            "weak_count": len(weak),
            "resist_count": len(resistant) + len(immune)
        }

    biggest_weaknesses = sorted(
        TYPES,
        key=lambda t: (
            analysis[t]["weak_count"],
            -analysis[t]["resist_count"]
        ),
        reverse=True
    )

    return {
        "team": team,
        "matchups": analysis,
        "weakness_ranking": [
            {
                "type": attack_type,
                "weak_count": analysis[attack_type]["weak_count"],
                "resist_count": analysis[attack_type]["resist_count"]
            }
            for attack_type in biggest_weaknesses
        ]
    }


if __name__ == "__main__":
    import json

    example_team = [
        "dragonite",
        "garchomp",
        "salamence",
        "heatran",
        "rotom-wash",
        "corviknight"
    ]

    result = analyze_team_types(example_team)

    print(json.dumps({
        "team": result.get("team"),
        "weakness_ranking": result.get("weakness_ranking")
    }, indent=2))
