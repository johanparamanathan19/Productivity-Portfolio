import unittest
from app import add


class TestApp(unittest.TestCase):
    """Test suite for the app module."""

    def test_add(self):
        # Verify that add() correctly computes the sum of two integers.
        self.assertEqual(add(2, 3), 5)


if __name__ == '__main__':
    # Run the unit tests when this module is executed directly.
    unittest.main()