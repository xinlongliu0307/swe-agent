import unittest

from contacts.match import same_person


class MatchTest(unittest.TestCase):
    def test_email_or_phone(self):
        self.assertTrue(same_person({"email": "A@x.org"}, {"email": "a@x.org "}))
        self.assertTrue(same_person({"phone": "+61 3 6226 2999"}, {"phone": "03 6226 2999"}))
        self.assertFalse(same_person({"email": "", "phone": ""}, {"email": "", "phone": ""}))


if __name__ == "__main__":
    unittest.main()
