import pytest
from sorter import merge_sort


def test_empty_list():
    assert merge_sort([]) == []


def test_single_element():
    assert merge_sort([42]) == [42]


def test_already_sorted():
    assert merge_sort([1, 2, 3, 4, 5]) == [1, 2, 3, 4, 5]


def test_reverse_sorted():
    assert merge_sort([5, 4, 3, 2, 1]) == [1, 2, 3, 4, 5]


def test_duplicates():
    assert merge_sort([3, 1, 4, 1, 5, 9, 2, 6, 5]) == [1, 1, 2, 3, 4, 5, 5, 6, 9]


def test_negative_numbers():
    assert merge_sort([-3, -1, -4, -1, -5]) == [-5, -4, -3, -1, -1]


def test_mixed_positive_negative():
    assert merge_sort([3, -2, 7, -5, 0, 1]) == [-5, -2, 0, 1, 3, 7]


def test_does_not_modify_original():
    original = [5, 3, 1, 4, 2]
    sorted_copy = merge_sort(original)
    assert original == [5, 3, 1, 4, 2]
    assert sorted_copy == [1, 2, 3, 4, 5]
