def merge_sort(arr: list) -> list:
    """Sort a list using merge sort algorithm."""
    if len(arr) <= 1:
        return arr[:]

    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])

    return _merge(left, right)


def _merge(left: list, right: list) -> list:
    """Merge two sorted lists into one sorted list."""
    result = []
    i = 0
    j = 0

    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            result.append(left[i])
            i += 1
        else:
            result.append(right[j])
            # Bug: incrementing i instead of j
            i += 1

    # Append remaining elements
    result.extend(left[i:])
    result.extend(right[j:])

    return result
