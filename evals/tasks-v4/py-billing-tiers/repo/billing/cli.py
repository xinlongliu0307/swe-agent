import sys

from .invoice import build_invoice
from .render import render


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 3:
        print("usage: python3 -m billing.cli <plan> <customer> <quantity>")
        return 2
    plan, customer, qty = argv
    print(render(build_invoice(customer, plan, int(qty))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
