import unittest

from shapes.cli import main
from shapes.report import describe, total_area


class ShapesTest(unittest.TestCase):
    def test_describe_rect(self):
        self.assertEqual(describe("rect", [2, 3]), "rect: area 6.00, perimeter 10.00")

    def test_total_area(self):
        self.assertAlmostEqual(total_area([("rect", [2, 3]), ("rect", [1, 1])]), 7.0)

    def test_cli_triangle(self):
        self.assertEqual(main(["triangle 3 4 5"]), ["triangle 6.00 12.00"])


if __name__ == "__main__":
    unittest.main()
