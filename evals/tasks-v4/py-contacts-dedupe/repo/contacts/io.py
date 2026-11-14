import csv

from .models import FIELDS, make_contact


def read_csv(path):
    with open(path, newline="") as f:
        return [make_contact(**{k: v for k, v in row.items() if k in FIELDS}) for row in csv.DictReader(f)]


def write_csv(path, contacts):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(FIELDS))
        w.writeheader()
        for c in contacts:
            w.writerow(c)
