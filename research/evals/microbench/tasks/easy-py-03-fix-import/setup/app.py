from helpers import sanitize_input, validate_email


def process_signup(name, email):
    clean_name = sanitize_input(name)
    if not validate_email(email):
        raise ValueError(f"Invalid email: {email}")
    return {"name": clean_name, "email": email}


if __name__ == "__main__":
    result = process_signup("  Alice  ", "alice@example.com")
    print(result)
