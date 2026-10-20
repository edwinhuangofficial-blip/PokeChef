
import os
import json

from dotenv import load_dotenv
from openai import OpenAI

from pokemon_tools import get_pokemon
from move_tools import get_move
from type_tools import calculate_type_multiplier, get_defensive_matchups
from team_tools import analyze_team_types

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# Describe the tools available to the LLM
TOOLS = [
    {
        "type": "function",
        "name": "get_pokemon",
        "description": "Look up a Pokémon's types, abilities, and base stats.",
        "parameters": {
            "type": "object",
            "properties": {
                "pokemon_name": {
                    "type": "string",
                    "description": "The Pokémon species name"
                }
            },
            "required": ["pokemon_name"],
            "additionalProperties": False
        },
        "strict": True
    },
    {
        "type": "function",
        "name": "get_move",
        "description": "Look up a Pokémon move's type, power, accuracy, PP, and damage class.",
        "parameters": {
            "type": "object",
            "properties": {
                "move_name": {
                    "type": "string",
                    "description": "The move name"
                }
            },
            "required": ["move_name"],
            "additionalProperties": False
        },
        "strict": True
    },
    {
    "type": "function",
    "name": "calculate_type_multiplier",
    "description": (
        "Calculate type effectiveness for an attacking Pokémon type "
        "against one or two defending Pokémon types. "
        "Use get_pokemon first if the defender's types are unknown."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "attack_type": {
                "type": "string",
                "description": "Attacking type, such as ice or ground"
            },
            "defender_types": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Defending types, such as ['dragon', 'flying']"
            }
        },
        "required": ["attack_type", "defender_types"],
        "additionalProperties": False
    },
    "strict": True
},
{
    "type": "function",
    "name": "analyze_team_types",
    "description": (
        "Analyze the defensive type weaknesses, resistances, "
        "and immunities of a Pokémon team of up to six members. "
        "Use this when a user asks about team-wide weaknesses "
        "or defensive type coverage."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "team_names": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of 1 to 6 Pokémon species names"
            }
        },
        "required": ["team_names"],
        "additionalProperties": False
    },
    "strict": True
},
{
    "type": "function",
    "name": "get_defensive_matchups",
    "description": (
        "Calculate ALL weaknesses, resistances and immunities "
        "of an individual Pokémon. Use this for questions about "
        "a Pokémon's complete defensive type matchups."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "pokemon_name": {
                "type": "string",
                "description": "Name of the Pokémon to analyze"
            }
        },
        "required": ["pokemon_name"],
        "additionalProperties": False
    },
    "strict": True
}
]


# Only these registered Python functions can be called
FUNCTIONS = {
    "get_pokemon": get_pokemon,
    "get_move": get_move,
    "calculate_type_multiplier": calculate_type_multiplier,
    "analyze_team_types": analyze_team_types,
    "get_defensive_matchups": get_defensive_matchups
}


def chat(message, conversation=None):
    # Keep only recent text turns; never accept client-supplied instructions/tools.
    history = []
    remaining = 12000
    for turn in reversed((conversation or [])[-12:]):
        if turn.get("role") not in ("user", "assistant"):
            continue
        content = turn.get("content", "")
        if not isinstance(content, str) or not content.strip():
            continue
        if len(content) > remaining:
            break
        history.insert(0, {"role": turn["role"], "content": content})
        remaining -= len(content)
    history.append({"role": "user", "content": message})

    # Maximum of 3 model requests per question
    for _ in range(3):
        response = client.responses.create(
            model="gpt-5-mini",
            instructions=(
                "You are PokéChef, a competitive Pokémon assistant. "
                "Use your tools for Pokémon stats and move data. "
                "Never invent tool results. Be concise."
                "Always use get_defensive_matchups for a Pokemon's complete weaknesses "
                "or resistances. Use calculate_type_multiplier for one specific attacking "
                "type. Never guess type effectiveness when a calculation tool is available. "
            ),
            input=history,
            tools=TOOLS,
            reasoning={"effort": "minimal"},
            max_output_tokens = 1500
        )

        if response.status == "incomplete":
            return f"Incomplete response: {response.incomplete_details}"

        history.extend(
            item.model_dump(exclude_none=True, exclude={"status"})
            for item in response.output
        )

        tool_calls = [
            item for item in response.output
            if item.type == "function_call"
        ]

        if not tool_calls:
            return response.output_text or "No answer generated."

        for call in tool_calls:
            print(f"[Tool called: {call.name}]")

            try:
                arguments = json.loads(call.arguments)
                function = FUNCTIONS.get(call.name)

                if function is None:
                    result = {"error": "Unknown tool"}
                else:
                    result = function(**arguments)

            except (ValueError, TypeError, KeyError) as error:
                result = {"error": str(error)}
            except Exception:
                result = {"error": "Tool execution failed"}

            history.append({
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": json.dumps(result)
            })

    return "PokéChef reached its tool-call limit. Try a simpler question."


if __name__ == "__main__":
    while True:
        question = input("\nYou: ").strip()

        if question.lower() in ("quit", "exit"):
            break

        if not question:
            continue

        print(f"\nPokéChef: {chat(question)}")
