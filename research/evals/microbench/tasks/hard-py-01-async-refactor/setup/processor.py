from data_fetcher import fetch_users, fetch_orders, fetch_product_details


def process_user_orders():
    """Process all users and their orders, returning a summary."""
    users = fetch_users()
    results = []

    for user in users:
        orders = fetch_orders(user["id"])
        order_details = []

        for order in orders:
            product = fetch_product_details(order["order_id"])
            order_details.append({
                "order_id": order["order_id"],
                "total": order["total"],
                "product": product["product"],
                "qty": product["qty"],
            })

        results.append({
            "user": user["name"],
            "email": user["email"],
            "orders": order_details,
        })

    return results


def get_summary():
    """Get a text summary of all user orders."""
    data = process_user_orders()
    lines = []
    for entry in data:
        lines.append(f"User: {entry['user']} ({entry['email']})")
        if not entry["orders"]:
            lines.append("  No orders.")
        for o in entry["orders"]:
            lines.append(f"  Order #{o['order_id']}: {o['product']} x{o['qty']} - ${o['total']}")
    return "\n".join(lines)
