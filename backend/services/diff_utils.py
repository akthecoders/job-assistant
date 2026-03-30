"""
diff_utils.py — Line-level diff between two text strings.
Uses Python stdlib difflib — no external dependencies.
"""
import difflib


def compute_diff(text_a: str, text_b: str) -> list[dict]:
    """
    Return a list of diff operations between text_a and text_b.
    Each item: {"type": "equal"|"add"|"remove", "content": str}
    """
    lines_a = text_a.splitlines(keepends=True)
    lines_b = text_b.splitlines(keepends=True)

    matcher = difflib.SequenceMatcher(None, lines_a, lines_b, autojunk=False)
    result = []

    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == "equal":
            for line in lines_a[i1:i2]:
                result.append({"type": "equal", "content": line.rstrip("\n")})
        elif op == "replace":
            for line in lines_a[i1:i2]:
                result.append({"type": "remove", "content": line.rstrip("\n")})
            for line in lines_b[j1:j2]:
                result.append({"type": "add", "content": line.rstrip("\n")})
        elif op == "delete":
            for line in lines_a[i1:i2]:
                result.append({"type": "remove", "content": line.rstrip("\n")})
        elif op == "insert":
            for line in lines_b[j1:j2]:
                result.append({"type": "add", "content": line.rstrip("\n")})

    return result


def diff_summary(text_a: str, text_b: str) -> dict:
    """Return a summary: lines added, removed, unchanged."""
    ops = compute_diff(text_a, text_b)
    added = sum(1 for o in ops if o["type"] == "add")
    removed = sum(1 for o in ops if o["type"] == "remove")
    return {"added": added, "removed": removed, "unchanged": len(ops) - added - removed}
