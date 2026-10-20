import json

from agent import client
from showdown_parser import parse_showdown_team
from team_tools import analyze_team_types


REVIEW_INSTRUCTIONS = """
You are PokéChef, a competitive Pokémon team reviewer.

Use the supplied structured team data and calculated
type matchups to evaluate the team.

Organize your response into:
1. Team identity and strategy
2. Strengths
3. Main problems
4. Three actionable improvements

Discuss actual moves, items, abilities, and EVs when relevant.

Rules:
- Do not invent moves, items, abilities, or EVs.
- Distinguish verified type matchups from strategic predictions.
- Do not claim legality has been verified.
- Do not assume a competitive format if none is specified.
- If recommending a set change, explain why.
- Be specific, helpful, and reasonably concise.
"""


def prepare_team(team_text):
    """Parse the team and prepare verified analysis data."""

    parsed = parse_showdown_team(team_text)

    if "error" in parsed:
        return {"error": parsed["error"]}

    names = [pokemon["species"] for pokemon in parsed["team"]]

    type_analysis = analyze_team_types(names)

    if "error" in type_analysis:
        return {"error": type_analysis["error"]}

    # Send only the most relevant type information
    # to the LLM to reduce token costs.
    biggest_weaknesses = []

    for entry in type_analysis["weakness_ranking"]:
        if entry["weak_count"] == 0:
            continue

        attack_type = entry["type"]
        matchup = type_analysis["matchups"][attack_type]

        biggest_weaknesses.append({
            "type": attack_type,
            "weak_to": matchup["weak"],
            "resistant": matchup["resistant"],
            "immune": matchup["immune"]
        })

        if len(biggest_weaknesses) >= 5:
            break

    return {
        "pokemon": parsed["team"],
        "defensive_concerns": biggest_weaknesses,
        "note": (
            "Type chart only. Ability, item, Tera, "
            "move effects and format legality are not verified."
        )
    }


def ask_review_model(team_data, question=None):
    """Generate a strategic explanation from structured data."""

    if question is None:
        task = "Review this competitive Pokémon team."
    else:
        task = f"Answer this question about the team: {question}"

    response = client.responses.create(
        model="gpt-5-mini",
        instructions=REVIEW_INSTRUCTIONS,
        input=(
            f"TEAM DATA:\n{json.dumps(team_data)}\n\n"
            f"TASK:\n{task}"
        ),
        reasoning={"effort": "minimal"},
        max_output_tokens=1200
    )

    if response.status != "completed" or not response.output_text:
        raise RuntimeError("The AI did not finish its response.")

    return response.output_text


def review_team(team_text):
    """Review a pasted Pokémon Showdown team."""

    team_data = prepare_team(team_text)

    if "error" in team_data:
        return team_data

    review = ask_review_model(team_data)

    return {
        "team": team_data["pokemon"],
        "review": review
    }


def follow_up_team(team_text, question):
    """Answer a question about a previously pasted team."""

    team_data = prepare_team(team_text)

    if "error" in team_data:
        return team_data

    answer = ask_review_model(team_data, question)

    return {"answer": answer}