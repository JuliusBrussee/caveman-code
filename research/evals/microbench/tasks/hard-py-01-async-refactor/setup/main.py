from processor import get_summary


def main():
    """Entry point: fetch and display order summary."""
    summary = get_summary()
    print(summary)
    return summary


if __name__ == "__main__":
    main()
