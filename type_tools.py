
from functools import lru_cache

import requests

from pokemon_tools import get_pokemon


TYPES = [
    "normal", "fire", "water", "electric", "grass",
    "ice", "fighting", "poison", "ground", "flying",
    "psychic", "bug", "rock", "ghost", "dragon",
    "dark", "steel", "fairy"
]


@lru_cache(maxsize=18)
def get_type_relations(attack_type):
    """Fetch and cache type effectiveness data from PokéAPI."""
    url = f"https://pokeapi.co/api/v2/type/{attack_type}"
    response = requests.get(url, timeout=10)
    response.raise_for_status()

    relations = response.json()["damage_relations"]

    return {
        "double": {
            entry["name"] for entry in relations["double_damage_to"]
        },
        "half": {
            entry["name"] for entry in relations["half_damage_to"]
        },
        "immune": {
            entry["name"] for entry in relations["no_damage_to"]
        }
    }


def get_multiplier(attack_type, defender_types):
    """Calculate the type multiplier against one or two types."""
    relations = get_type_relations(attack_type.lower().strip())
    multiplier = 1.0

    for defender_type in defender_types:
        defender_type = defender_type.lower().strip()

        if defender_type in relations["immune"]:
            multiplier *= 0
        elif defender_type in relations["double"]:
            multiplier *= 2
        elif defender_type in relations["half"]:
            multiplier *= 0.5

    return multiplier


def calculate_type_multiplier(attack_type, defender_types):
    """Agent tool for one specific attacking type."""
    attack_type = attack_type.lower().strip()

    if attack_type not in TYPES:
        return {"error": f"Unknown attacking type: {attack_type}"}

    if (
        not isinstance(defender_types, list)
        or not 1 <= len(defender_types) <= 2
        or any(not isinstance(t, str) or t.lower().strip() not in TYPES
               for t in defender_types)
    ):
        return {"error": "Provide one or two valid defending types."}

    return {
        "attack_type": attack_type,
        "defender_types": defender_types,
        "multiplier": get_multiplier(attack_type, defender_types)
    }


def get_defensive_matchups(pokemon_name):
    """Calculate every standard defensive type matchup."""
    pokemon = get_pokemon(pokemon_name.strip().lower().replace(" ", "-"))

    if "error" in pokemon:
        return pokemon

    weaknesses = {}
    resistances = {}
    immunities = {}

    for attack_type in TYPES:
        multiplier = get_multiplier(attack_type, pokemon["types"])

        if multiplier == 0:
            immunities[attack_type] = multiplier
        elif multiplier > 1:
            weaknesses[attack_type] = multiplier
        elif multiplier < 1:
            resistances[attack_type] = multiplier

    return {
        "pokemon": pokemon["name"],
        "types": pokemon["types"],
        "weaknesses": weaknesses,
        "resistances": resistances,
        "immunities": immunities
    }


if __name__ == "__main__":
    from pprint import pprint

    pprint(get_defensive_matchups("greninja"))