import requests


def get_move(move_name):
    move_name = move_name.lower().replace(" ", "-")

    url = f"https://pokeapi.co/api/v2/move/{move_name}"

    response = requests.get(url)

    if response.status_code == 404:
        return {"error": "Move not found"}

    response.raise_for_status()

    data = response.json()

    return {
        "name": data["name"],
        "type": data["type"]["name"],
        "power": data["power"],
        "accuracy": data["accuracy"],
        "pp": data["pp"],
        "damage_class": data["damage_class"]["name"]
    }


if __name__ == "__main__":
    move = input("What move do you want PokéChef to look up? ")

    print(get_move(move))