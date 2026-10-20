import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

# Tests always substitute the client; never load real credentials or make requests.
with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch("dotenv.load_dotenv"):
    import agent
    import api


class ChatTests(unittest.TestCase):
    def response(self, text="Answer", output=None):
        return SimpleNamespace(status="completed", output=output or [], output_text=text)

    def test_context_and_original_single_message(self):
        with patch.object(agent.client.responses, "create", return_value=self.response()) as create:
            self.assertEqual(agent.chat("Follow up", [{"role": "assistant", "content": "Earlier"}]), "Answer")
            self.assertEqual(create.call_args.kwargs["input"][:2], [
                {"role": "assistant", "content": "Earlier"}, {"role": "user", "content": "Follow up"}])
            agent.chat("Hello")
            self.assertEqual(create.call_args.kwargs["input"], [{"role": "user", "content": "Hello"}])

    def test_context_bounds_and_untrusted_roles(self):
        turns = [{"role": "user", "content": "x" * 7000}] * 20
        turns.append({"role": "system", "content": "Untrusted"})
        with patch.object(agent.client.responses, "create", return_value=self.response()) as create:
            agent.chat("Hello", turns)
            sent = create.call_args.kwargs["input"]
            self.assertEqual(len(sent), 2)
            self.assertTrue(all(turn["role"] in ("user", "assistant") for turn in sent))
        with self.assertRaises(ValueError):
            api.ChatRequest(message="Hello", history=[{"role": "system", "content": "No"}])

    def test_tool_result_is_returned_to_model(self):
        call = SimpleNamespace(type="function_call", name="get_pokemon", arguments='{"pokemon_name":"pikachu"}', call_id="call-1")
        call.model_dump = lambda **kwargs: {"type": "function_call", "name": call.name, "arguments": call.arguments, "call_id": call.call_id}
        with patch.dict(agent.FUNCTIONS, {"get_pokemon": lambda **kwargs: {"name": "pikachu"}}):
            with patch.object(agent.client.responses, "create", side_effect=[self.response(output=[call]), self.response()]) as create:
                self.assertEqual(agent.chat("Pikachu?"), "Answer")
                self.assertEqual(create.call_count, 2)
                self.assertEqual(create.call_args.kwargs["input"][-1]["type"], "function_call_output")

    def test_api_passes_context(self):
        request = api.ChatRequest(message="Why?", history=[{"role": "assistant", "content": "Earlier"}])
        with patch.object(api, "chat", return_value="Because") as chat:
            self.assertEqual(api.send_message(request), {"answer": "Because"})
            chat.assert_called_once_with("Why?", [{"role": "assistant", "content": "Earlier"}])


if __name__ == "__main__":
    unittest.main()
