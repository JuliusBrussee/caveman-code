import pytest
from calculator import Calculator


def test_add():
    calc = Calculator()
    assert calc.add(2, 3) == 5


def test_subtract():
    calc = Calculator()
    assert calc.subtract(10, 4) == 6


def test_multiply():
    calc = Calculator()
    assert calc.multiply(3, 7) == 21


def test_divide():
    calc = Calculator()
    assert calc.divide(10, 2) == 5.0


def test_divide_by_zero():
    calc = Calculator()
    with pytest.raises(ZeroDivisionError):
        calc.divide(10, 0)
