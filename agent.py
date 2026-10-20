
import os
import json

from dotenv import load_dotenv
from openai import OpenAI

from pokemon_tools import get_pokemon
from move_tools import get_move


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
    }
]


# Only these registered Python functions can be called
FUNCTIONS = {
    "get_pokemon": get_pokemon,
    "get_move": get_move
}


def chat(message):
    history = [{"role": "user", "content": message}]

    # Maximum of 3 model requests per question
    for _ in range(3):
        response = client.responses.create(
            model="gpt-5-mini",
            instructions=(
                "You are PokéChef, a competitive Pokémon assistant. "
                "Use your tools for Pokémon stats and move data. "
                "Never invent tool results. Be concise."
            ),
            input=history,
            tools=TOOLS,
            reasoning={"effort": "minimal"},
            max_output_tokens=500
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
