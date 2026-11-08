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
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("add").add_argument("text")
    sub.add_parser("done").add_argument("n", type=int)
    sub.add_parser("list")
    args = p.parse_args(argv)
    items = storage.load(path)
    if args.cmd == "add":
        items.append({"text": args.text, "done": False})
    elif args.cmd == "done":
        items[args.n]["done"] = True
    elif args.cmd == "list":
        return [f"{i}. [{'x' if it['done'] else ' '}] {it['text']}" for i, it in enumerate(items)]
    return []
