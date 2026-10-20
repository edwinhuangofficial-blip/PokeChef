import requests


def get_pokemon(pokemon_name):
    url = f"https://pokeapi.co/api/v2/pokemon/{pokemon_name.lower()}"

    response = requests.get(url)

    if response.status_code == 404:
        return {"error": "Pokemon not found"}

    response.raise_for_status()

    data = response.json()

    types = [
        type_info["type"]["name"]
        for type_info in data["types"]
    ]

    abilities = [
        ability_info["ability"]["name"]
        for ability_info in data["abilities"]
    ]

    stats = {
        stat_info["stat"]["name"]: stat_info["base_stat"]
        for stat_info in data["stats"]
    }

    return {
        "name": data["name"],
        "id": data["id"],
        "types": types,
        "abilities": abilities,
        "stats": stats
    }


if __name__ == "__main__":
    pokemon = input("What Pokemon do you want PokéChef to look up? ")

    result = get_pokemon(pokemon)

    print(result)