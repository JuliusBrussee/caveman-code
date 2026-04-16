import time


def fetch_users():
    """Fetch a list of users from the API."""
    time.sleep(0.01)
    return [
        {"id": 1, "name": "Alice", "email": "alice@example.com"},
        {"id": 2, "name": "Bob", "email": "bob@example.com"},
        {"id": 3, "name": "Charlie", "email": "charlie@example.com"},
    ]


def fetch_orders(user_id):
    """Fetch orders for a given user."""
    time.sleep(0.01)
    orders = {
        1: [{"order_id": 101, "total": 59.99}, {"order_id": 102, "total": 24.50}],
        2: [{"order_id": 201, "total": 120.00}],
        3: [],
    }
    return orders.get(user_id, [])


def fetch_product_details(order_id):
    """Fetch product details for a given order."""
    time.sleep(0.01)
    products = {
        101: {"product": "Widget A", "qty": 2},
        102: {"product": "Widget B", "qty": 1},
        201: {"product": "Gadget X", "qty": 5},
    }
    return products.get(order_id, {"product": "Unknown", "qty": 0})
