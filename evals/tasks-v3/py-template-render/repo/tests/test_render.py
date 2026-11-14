import unittest

from tmpl.lexer import tokens
from tmpl.render import render


class RenderTest(unittest.TestCase):
    def test_plain_variable(self):
        self.assertEqual(render("Hello {{ name }}!", {"name": "Bo"}), "Hello Bo!")

    def test_filter(self):
        self.assertEqual(render("{{name|upper}}", {"name": "bo"}), "BO")

    def test_dotted(self):
        self.assertEqual(render("{{ a.b }}", {"a": {"b": 1}}), "1")

    def test_tokens(self):
        self.assertEqual(tokens("x{{ y }}"), [("text", "x"), ("var", "y")])


if __name__ == "__main__":
    unittest.main()
