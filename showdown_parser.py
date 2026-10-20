import re


STATS = {"HP", "Atk", "Def", "SpA", "SpD", "Spe"}


def parse_stats(line):
    """Convert Showdown EV/IV text into a dictionary."""
    result = {}

    for part in line.split("/"):
        match = re.fullmatch(
            r"\s*(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)\s*",
            part,
            flags=re.IGNORECASE
        )

        if not match:
            raise ValueError(f"Invalid stat entry: {part}")

        amount = int(match.group(1))
        stat = match.group(2).lower()
        if stat in result:
            raise ValueError(f"Duplicate stat: {match.group(2)}")
        result[stat] = amount

    return result


def parse_pokemon(block):
    """Parse one Pokémon's Showdown export."""
    lines = [line.strip() for line in block.splitlines() if line.strip()]

    if not lines:
        raise ValueError("Empty Pokémon entry")

    header = lines[0]
    if header.startswith("-") or ":" in header:
        raise ValueError("Expected a Pokémon name on the first line.")

    # Example: Dragonite @ Heavy-Duty Boots
    if " @ " in header:
        name_part, item = header.split(" @ ", 1)
    else:
        name_part, item = header, None

    # Examples:
    # Dragonite
    # Sparky (Pikachu)
    # Dragonite (M)
    gender = None
    if name_part.endswith(" (M)") or name_part.endswith(" (F)"):
        gender = name_part[-2]
        name_part = name_part[:-4].strip()

    nickname = None
    species = name_part

    match = re.fullmatch(r"(.+?)\s+\(([^()]+)\)", name_part)
    if match:
        nickname = match.group(1)
        species = match.group(2)

    pokemon = {
        "species": species,
        "nickname": nickname,
        "gender": gender,
        "item": item,
        "ability": None,
        "level": 100,
        "tera_type": None,
        "nature": None,
        "evs": {},
        "ivs": {},
        "moves": []
    }
    if not species.strip() or item == "":
        raise ValueError("Pokémon name or held item is empty.")
    warnings = []
    seen = {"Gender"} if gender else set()

    for line in lines[1:]:
        field = line.split(":", 1)[0] if ":" in line else ("Nature" if line.endswith(" Nature") else None)
        if field in {"Ability", "Gender", "Level", "Tera Type", "EVs", "IVs", "Nature"}:
            if field in seen:
                raise ValueError(f"{species}: duplicate {field} field.")
            seen.add(field)
            if ":" in line and not line.split(":", 1)[1].strip():
                raise ValueError(f"{species}: {field} is empty.")
        if line.startswith("Ability: "):
            pokemon["ability"] = line.removeprefix("Ability: ")

        elif line.startswith("Gender: "):
            value = line.removeprefix("Gender: ").strip()
            if value not in {"M", "F", "N"}:
                raise ValueError(f"{species}: gender must be M, F, or N.")
            pokemon["gender"] = value

        elif line.startswith("Level: "):
            pokemon["level"] = int(line.removeprefix("Level: "))

        elif line.startswith("Tera Type: "):
            pokemon["tera_type"] = line.removeprefix("Tera Type: ")

        elif line.startswith("EVs: "):
            pokemon["evs"] = parse_stats(line.removeprefix("EVs: "))

        elif line.startswith("IVs: "):
            pokemon["ivs"] = parse_stats(line.removeprefix("IVs: "))

        elif line.endswith(" Nature"):
            pokemon["nature"] = line.removesuffix(" Nature")

        elif line.startswith("- "):
            pokemon["moves"].append(line[2:])
        else:
            warnings.append(f"{species}: unrecognized line was not imported: {line}")

    if not 1 <= pokemon["level"] <= 100:
        raise ValueError(f"{species}: level must be between 1 and 100.")
    if any(value > 252 for value in pokemon["evs"].values()) or sum(pokemon["evs"].values()) > 510:
        raise ValueError(f"{species}: EVs must be 0–252 per stat and total at most 510.")
    if any(value > 31 for value in pokemon["ivs"].values()):
        raise ValueError(f"{species}: IVs must be between 0 and 31.")
    if len(pokemon["moves"]) > 4 or len(set(pokemon["moves"])) != len(pokemon["moves"]):
        raise ValueError(f"{species}: provide at most four different moves.")
    for key, label in (("ability", "ability"), ("nature", "nature"), ("evs", "EV spread"), ("moves", "moves")):
        if not pokemon[key]:
            warnings.append(f"{species}: no {label} specified.")
    if not pokemon["item"]:
        warnings.append(f"{species}: no held item specified; this may be intentional.")
    pokemon["import_warnings"] = warnings

    return pokemon


def parse_showdown_team(text):
    """Parse a full Showdown team of up to six Pokémon."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    # A Showdown team export may begin with a team/format heading.
    if text.startswith("==="):
        text = "\n".join(text.splitlines()[1:]).strip()
    if any(line.strip().startswith("===") for line in text.splitlines()):
        return {"error": "Import one team at a time, rather than a full team backup."}
    blocks = re.split(r"\n\s*\n", text)

    if not text.strip():
        return {"error": "Paste a Pokémon Showdown team first."}

    if len(blocks) > 6:
        return {"error": "A team can contain at most six Pokémon."}

    try:
        team = [parse_pokemon(block) for block in blocks]
    except ValueError as error:
        return {"error": str(error)}

    return {
        "count": len(team),
        "team": team,
        "warnings": [warning for pokemon in team for warning in pokemon.pop("import_warnings")],
        "note": "Import preview only. Names, set legality, and format rules have not been verified."
    }


if __name__ == "__main__":
    example = """Dragonite @ Heavy-Duty Boots
Ability: Multiscale
Level: 100
Tera Type: Normal
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Dragon Dance
- Extreme Speed
- Earthquake
- Roost

Heatran @ Leftovers
Ability: Flash Fire
EVs: 252 HP / 4 SpA / 252 SpD
Calm Nature
- Magma Storm
- Earth Power
- Stealth Rock
- Taunt"""

    from pprint import pprint
    pprint(parse_showdown_team(example))
