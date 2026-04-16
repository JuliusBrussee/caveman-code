def find_pairs(numbers, target):
    """Find all unique pairs of numbers that sum to the target.

    Args:
        numbers: List of integers.
        target: Target sum.

    Returns:
        List of tuples (a, b) where a + b == target and a <= b.
        Each pair appears only once, sorted by the first element.
    """
    pairs = []
    n = len(numbers)
    seen_pairs = set()

    for i in range(n):
        for j in range(i + 1, n):
            if numbers[i] + numbers[j] == target:
                a, b = min(numbers[i], numbers[j]), max(numbers[i], numbers[j])
                if (a, b) not in seen_pairs:
                    seen_pairs.add((a, b))
                    pairs.append((a, b))

    pairs.sort()
    return pairs


def find_triplets(numbers, target):
    """Find all unique triplets of numbers that sum to the target.

    Args:
        numbers: List of integers.
        target: Target sum.

    Returns:
        List of tuples (a, b, c) where a + b + c == target and a <= b <= c.
        Each triplet appears only once, sorted.
    """
    triplets = []
    n = len(numbers)
    seen = set()

    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                if numbers[i] + numbers[j] + numbers[k] == target:
                    triple = tuple(sorted([numbers[i], numbers[j], numbers[k]]))
                    if triple not in seen:
                        seen.add(triple)
                        triplets.append(triple)

    triplets.sort()
    return triplets
