#!/usr/bin/env python3
"""Determinism lint for video-forge pages (the determinism contract, machine-checked).

The frame must be a pure function of t: any wall-clock source, timer, or
unseeded randomness tears frames apart and breaks isolated re-renders.
This scans the project's html/js/css for the usual offenders.

用法:
  python lint_page.py <file-or-dir> [--warn]          # default: findings -> exit 1
  python lint_page.py .                                # whole project

Per-line exemption: append a `vf:allow` comment to a line you have thought
about (e.g. parsing a fixed date during setup, outside render(t)).

  const launch = new Date('2026-01-01'); // vf:allow fixed date, setup only

Run before every render (SKILL.md step 6 makes this mandatory).
"""
import argparse, pathlib, re, sys

# (label, regex, why it matters)
PATTERNS = [
    ("Math.random",   r"Math\s*\.\s*random\s*\(",           "unseeded randomness — use VF.random(seed)"),
    ("Date.now",      r"\bDate\s*\.\s*now\s*\(",              "wall clock — the frame may only depend on t"),
    ("new Date",      r"new\s+Date\s*\(",                     "wall clock — parse fixed dates outside render(t)"),
    ("performance",   r"\bperformance\s*\.\s*now\s*\(",       "wall clock"),
    ("rAF",           r"\brequestAnimationFrame\b",           "the renderer drives every frame — no rAF loop"),
    ("timer",         r"\bset(?:Timeout|Interval)\s*\(",      "timers are wall-clock — schedule via the timeline"),
    ("css-transition", r"(?<![\w-])transition\s*:",           "CSS transitions run on the wall clock — write styles inside render(t)"),
    ("css-animation", r"(?<![\w-])animation\s*:",             "CSS keyframe animations run on the wall clock — banned"),
    ("AudioContext",  r"\b(?:webkit)?AudioContext\b",         "audio belongs to the mixdown pipeline, not the page"),
    ("document.timeline", r"\bdocument\s*\.\s*timeline\b",    "wall clock"),
]
SKIP_DIRS = {"out", "qa", "node_modules", "cache", "__pycache__", ".git", "audio"}
EXTS = {".html", ".htm", ".js", ".css"}
ALLOW = "vf:allow"


def lint(path: pathlib.Path):
    findings = []
    if path.is_file():
        files = [path]
    else:
        files = [f for f in sorted(path.rglob("*"))
                 if f.suffix.lower() in EXTS and not (set(f.parts) & SKIP_DIRS) and f.is_file()]
    for f in files:
        try:
            text = f.read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            findings.append((str(f), 0, "", f"unreadable: {e}"))
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            if ALLOW in line:
                continue
            for label, rx, why in PATTERNS:
                if re.search(rx, line):
                    findings.append((str(f), lineno, label, why))
    return findings


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("target", help="an html/js/css file, or a project directory")
    ap.add_argument("--warn", action="store_true", help="report findings but always exit 0")
    a = ap.parse_args()

    target = pathlib.Path(a.target)
    if not target.exists():
        sys.exit(f"lint: target not found: {target}")
    findings = lint(target)
    for f, lineno, label, why in findings:
        print(f"  {f}:{lineno}  [{label}]  {why}")
    if findings:
        n = len(findings)
        print(f"\n[lint] {n} finding(s). Fix them, or justify with an inline `{ALLOW}` comment.")
        sys.exit(0 if a.warn else 1)
    print("[lint] clean — determinism contract holds (seeded randomness only, no wall clock).")


if __name__ == "__main__":
    main()
