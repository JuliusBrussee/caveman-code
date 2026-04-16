import argparse
import sys


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Data processing tool for converting and analyzing datasets."
    )
    parser.add_argument(
        "--input",
        "-i",
        required=True,
        help="Path to the input data file",
    )
    parser.add_argument(
        "--output",
        "-o",
        required=True,
        help="Path to the output file",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        default=False,
        help="Enable verbose logging",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.verbose:
        print(f"Reading from: {args.input}")
        print(f"Writing to: {args.output}")

    print(f"Processing {args.input} -> {args.output}")


if __name__ == "__main__":
    main()
