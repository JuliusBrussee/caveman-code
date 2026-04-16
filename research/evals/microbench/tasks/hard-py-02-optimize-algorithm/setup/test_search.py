import time
import random
from search import find_pairs


class TestFindPairsCorrectness:
    def test_basic_pairs(self):
        result = find_pairs([1, 2, 3, 4, 5], 6)
        assert (1, 5) in result
        assert (2, 4) in result
        assert len(result) == 2

    def test_empty_list(self):
        result = find_pairs([], 5)
        assert result == []

    def test_no_pairs(self):
        result = find_pairs([1, 2, 3], 100)
        assert result == []

    def test_single_element(self):
        result = find_pairs([5], 10)
        assert result == []

    def test_negative_numbers(self):
        result = find_pairs([-3, -1, 0, 1, 3, 5], 2)
        assert (-3, 5) in result
        assert (-1, 3) in result
        assert len(result) == 2

    def test_duplicates_in_input(self):
        result = find_pairs([1, 1, 2, 3, 3], 4)
        assert (1, 3) in result
        assert len(result) == 1

    def test_zero_target(self):
        result = find_pairs([-2, -1, 0, 1, 2], 0)
        assert (-2, 2) in result
        assert (-1, 1) in result
        assert len(result) == 2

    def test_sorted_output(self):
        result = find_pairs([5, 1, 4, 2, 3, 7], 8)
        for i in range(len(result) - 1):
            assert result[i] <= result[i + 1]

    def test_pair_ordering(self):
        """Each pair (a, b) should have a <= b."""
        result = find_pairs([10, 1, 9, 2, 8], 10)
        for a, b in result:
            assert a <= b


class TestFindPairsPerformance:
    def test_large_input_performance(self):
        """find_pairs must complete in under 0.1s for n=100000."""
        random.seed(42)
        numbers = [random.randint(-50000, 50000) for _ in range(100000)]
        target = 1337

        start = time.time()
        result = find_pairs(numbers, target)
        elapsed = time.time() - start

        assert elapsed < 0.1, f"find_pairs took {elapsed:.3f}s, expected < 0.1s"
        # Sanity check: result should be a list of tuples
        assert isinstance(result, list)
        for pair in result:
            assert len(pair) == 2
            assert pair[0] + pair[1] == target
