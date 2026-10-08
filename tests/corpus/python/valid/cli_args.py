# covers: a multi-line call; a conditional expression
import argparse
import logging


def build_parser():
    parser = argparse.ArgumentParser(
        prog="duckstats",
        description="Summarise a log file.",
    )
    parser.add_argument("path", help="file to read")
    parser.add_argument(
        "-n", "--top",
        type=int,
        default=10,
        help="how many entries to show (default: %(default)s)",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.WARNING,
        format="%(levelname)s: %(message)s",
    )
    if args.top <= 0:
        logging.error("--top must be positive, got %d",
                      args.top)
        return 2
    if args.path.endswith(".gz"):
        logging.warning("compressed input is not supported")
    print(f"would read {args.path} and show {args.top}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
