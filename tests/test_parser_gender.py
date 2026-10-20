import unittest
from showdown_parser import parse_showdown_team


class GenderImportTests(unittest.TestCase):
    def test_standalone_gender_field(self):
        for gender in ("F", "M", "N"):
            with self.subTest(gender=gender):
                result = parse_showdown_team(f"Ninetales-Alola @ Light Clay\nAbility: Snow Warning\nGender: {gender}\nTimid Nature\nEVs: 248 HP / 8 Def / 252 Spe\n- Aurora Veil")
                self.assertEqual(result["team"][0]["gender"], gender)
                self.assertEqual(result["warnings"], [])

    def test_invalid_empty_or_duplicate_gender(self):
        for text in ("Pikachu\nGender: X", "Pikachu\nGender:", "Pikachu\nGender: F\nGender: M", "Pikachu (F)\nGender: M"):
            with self.subTest(text=text):
                self.assertIn("error", parse_showdown_team(text))

    def test_header_gender_still_works(self):
        result = parse_showdown_team("Sparky (Pikachu) (F) @ Light Ball\n- Thunderbolt")
        self.assertEqual(result["team"][0]["gender"], "F")
        self.assertEqual(result["team"][0]["nickname"], "Sparky")


if __name__ == "__main__":
    unittest.main()
