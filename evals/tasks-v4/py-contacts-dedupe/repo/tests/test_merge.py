import unittest

from contacts.merge import dedupe
from contacts.models import make_contact as c


class MergeTest(unittest.TestCase):
    def test_chain_and_order(self):
        people = [
            c(name="Bo", email="bo@x.org"),
            c(name="Ada", email="ada@x.org"),
            c(phone="0400 000 001", email="BO@x.org", company="Acme"),
            c(name="Ada L", phone="0400000001"),
        ]
        self.assertEqual(dedupe(people), [
            {"name": "Bo", "email": "bo@x.org", "phone": "0400 000 001", "company": "Acme"},
            {"name": "Ada", "email": "ada@x.org", "phone": "", "company": ""},
        ])

    def test_group_joined_by_a_later_contact(self):
        people = [c(name="A", email="a@x"), c(name="B", phone="1"), c(name="C", email="a@x", phone="1")]
        self.assertEqual([p["name"] for p in dedupe(people)], ["A"])


if __name__ == "__main__":
    unittest.main()
