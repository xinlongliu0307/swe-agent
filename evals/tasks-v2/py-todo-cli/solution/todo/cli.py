import argparse

from . import storage


def main(argv, path="todo.json"):
    """Run one command and return the lines it prints. Every change is saved to `path`.

    add TEXT   add an item
    done N     mark item N as done; N is 1-based, as shown by list. If there is no item N,
               return ["no such item: N"] and change nothing.
    list       return lines like "1. [ ] buy milk" or "2. [x] post letter"
    """
    p = argparse.ArgumentParser(prog="todo")
    sub = p.add_subparsers(dest="cmd")
    sub.required = True  # works on Python 3.6 too (required= needs 3.7+)
    sub.add_parser("add").add_argument("text")
    sub.add_parser("done").add_argument("n", type=int)
    sub.add_parser("list")
    args = p.parse_args(argv)
    items = storage.load(path)
    if args.cmd == "add":
        items.append({"text": args.text, "done": False})
    elif args.cmd == "done":
        if not 1 <= args.n <= len(items):
            return [f"no such item: {args.n}"]
        items[args.n - 1]["done"] = True
    elif args.cmd == "list":
        return [f"{i}. [{'x' if it['done'] else ' '}] {it['text']}" for i, it in enumerate(items, 1)]
    storage.save(path, items)
    return []
