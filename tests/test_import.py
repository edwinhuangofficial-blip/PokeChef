import os
import unittest
from unittest.mock import patch

from showdown_parser import parse_showdown_team

with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch("dotenv.load_dotenv"):
    import api
    import review_service


SET = """Sparky (Pikachu) (F) @ Light Ball
Ability: Static
Level: 50
Tera Type: Electric
EVs: 252 SpA / 4 SpD / 252 Spe
IVs: 0 Atk
Timid Nature
- Thunderbolt
- Volt Switch"""


class ImportTests(unittest.TestCase):
    def test_full_export_and_windows_newlines(self):
        parsed = parse_showdown_team(("=== [gen9ou] Example ===\n\n" + SET).replace("\n", "\r\n"))
        self.assertNotIn("error", parsed)
        pokemon = parsed["team"][0]
        self.assertEqual((pokemon["species"], pokemon["nickname"], pokemon["gender"]), ("Pikachu", "Sparky", "F"))
        self.assertEqual(pokemon["evs"], {"spa": 252, "spd": 4, "spe": 252})
        self.assertEqual(pokemon["ivs"], {"atk": 0})
        self.assertEqual(pokemon["level"], 50)
        self.assertEqual(parsed["warnings"], [])

    def test_missing_and_unknown_fields_are_visible(self):
        parsed = parse_showdown_team("Pikachu\nAbilty: Static\n- Thunderbolt")
        self.assertTrue(any("unrecognized line" in warning for warning in parsed["warnings"]))
        self.assertTrue(any("no ability" in warning for warning in parsed["warnings"]))

    def test_invalid_imports(self):
        for text in ["", "Pikachu\nLevel: 101", "Pikachu\nEVs: 253 Atk",
                     "Pikachu\nEVs: 252 Atk / 252 Spe / 252 HP", "Pikachu\nIVs: 32 HP",
                     "Pikachu\nEVs: 252 Atk / 4 Atk", "Pikachu\nAbility: Static\nAbility: Static",
                     "Pikachu\n- A\n- B\n- C\n- D\n- E", "Pikachu\nLevel: nope",
                     "\n\n".join(["Pikachu"] * 7)]:
            with self.subTest(text=text):
                self.assertIn("error", parse_showdown_team(text))

    def test_preview_never_calls_network_or_model(self):
        with patch("requests.get", side_effect=AssertionError("Network called")), patch.object(review_service.client.responses, "create", side_effect=AssertionError("AI called")):
            self.assertEqual(api.preview(api.TeamReviewRequest(team_text=SET))["count"], 1)
            with self.assertRaises(api.HTTPException) as caught:
                api.preview(api.TeamReviewRequest(team_text="Pikachu\nIVs: 99 HP"))
            self.assertEqual(caught.exception.status_code, 400)

    def test_invalid_review_stops_before_lookup_or_model(self):
        with patch.object(review_service, "analyze_team_types") as lookup, patch.object(review_service, "ask_review_model") as model:
            self.assertIn("error", review_service.review_team("Pikachu\nLevel: 999"))
            lookup.assert_not_called()
            model.assert_not_called()


if __name__ == "__main__":
    unittest.main()
