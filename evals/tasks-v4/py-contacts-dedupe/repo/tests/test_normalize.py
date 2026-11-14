import unittest

from contacts.normalize import norm_email, norm_phone


class NormalizeTest(unittest.TestCase):
    def test_email(self):
        self.assertEqual(norm_email("  Ada@Example.ORG "), "ada@example.org")
        self.assertEqual(norm_email(None), "")

    def test_phone(self):
        self.assertEqual(norm_phone("+61 3 6226 2999"), "0362262999")
        self.assertEqual(norm_phone("(03) 6226-2999"), "0362262999")
        self.assertEqual(norm_phone(""), "")


if __name__ == "__main__":
    unittest.main()
