import unittest
from users.models import User, get_user_name
from users.views import greeting
from reports.summary import roster


class T(unittest.TestCase):
    def test_greeting(self):
        self.assertEqual(greeting(User("Ada", "Lovelace")), "Hello, Ada Lovelace!")

    def test_roster(self):
        self.assertEqual(roster([User("B", "Two"), User("A", "One")]), "A One\nB Two")

    def test_old_name_still_works(self):
        self.assertEqual(get_user_name(User("A", "B")), "A B")


if __name__ == "__main__":
    unittest.main()
