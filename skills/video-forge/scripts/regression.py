#!/usr/bin/env python3
"""Golden-frame regression: hash key frames of a video-forge page and detect drift.

A golden-frame CI guard for the skill workflow: instead of storing
golden MP4s, render a handful of key frames to PNG and store their sha256 in
a manifest. Any change that alters a guarded frame — kernel tweak, FX change,
CSS edit — is caught before you ship.

用法:
  init   python regression.py page.html --out qa/golden --size 1920x1080 \
             --at 0,1.5,3.2            # explicit times
         ... --timeline audio/vo_timeline.json   # auto: 0, mid, each cut, end
  check  python regression.py page.html --out qa/golden ...   (no init/check verb)
  update python regression.py page.html --out qa/golden ... --update

Frames live in <out>/f_<t>.png next to manifest.json. Determinism note: hashes
are only comparable on the same machine/browser (font rasterization differs
across Chromium builds) — re-init after a browser upgrade.
"""
import argparse, hashlib, json, pathlib, sys

from playwright.sync_api import sync_playwright

from render import launch, page_url


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def pick_times(a):
    if a.at:
        times = [float(x) for x in a.at.split(",")]
    elif a.timeline:
        tl = json.load(open(a.timeline, encoding="utf-8"))
        cuts = [e["end"] for e in tl.get("lines", [])]
        total = tl.get("total") or (cuts[-1] if cuts else 0)
        times = [0.0] + cuts + [total / 2, max(0.0, total - 0.1)]
    else:
        sys.exit("regression: pass --at t1,t2,... or --timeline audio/vo_timeline.json")
    dur = a.duration
    if dur:
        times = [min(t, round(dur - 1 / a.fps, 3)) for t in times]
    times = sorted({round(max(0.0, t), 3) for t in times})
    return times


def render_frames(pg, times, outdir):
    outdir.mkdir(parents=True, exist_ok=True)
    frames = []
    for t in times:
        name = f"f_{t:.2f}.png"
        png = outdir / name
        try:
            pg.evaluate("t => window.render(t)", t)
            pg.screenshot(path=str(png), type="png")
        except Exception as e:
            sys.exit(f"regression: render failed at t={t}s: {str(e).splitlines()[0]}")
        frames.append({"t": t, "png": name, "sha": sha256_file(png)})
    return frames


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page")
    ap.add_argument("--out", default="qa/golden", help="manifest + PNG dir")
    ap.add_argument("--size", default="1920x1080")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--at", help="comma-separated times, e.g. 0,1.5,3.2")
    ap.add_argument("--timeline", help="vo_timeline.json — auto-pick 0, mid, each cut, end")
    ap.add_argument("--duration", type=float, help="clamp times to the film length")
    ap.add_argument("--update", action="store_true", help="(re)write the manifest after rendering")
    a = ap.parse_args()
    W, H = map(int, a.size.lower().split("x"))

    outdir = pathlib.Path(a.out)
    manifest_path = outdir / "manifest.json"
    times = pick_times(a)

    with sync_playwright() as p:
        browser = launch(p)
        pg = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        pg.goto(page_url(a.page))
        pg.wait_for_function("typeof window.render === 'function' && (window.ready === undefined || window.ready === true)", timeout=60000)
        pg.evaluate("document.fonts ? document.fonts.ready.then(() => true) : true")
        frames = render_frames(pg, times, outdir)
        browser.close()

    if a.update or not manifest_path.exists():
        manifest = {"page": a.page, "size": a.size, "frames": frames}
        manifest_path.write_text(json.dumps(manifest, indent=1), encoding="utf-8")
        print(f"[regression] manifest written: {manifest_path} ({len(frames)} frames)")
        for f in frames:
            print(f"  t={f['t']:6.2f}s  {f['sha'][:12]}")
        return

    old = json.loads(manifest_path.read_text(encoding="utf-8"))
    old_by_t = {round(f["t"], 2): f["sha"] for f in old["frames"]}
    drift = []
    for f in frames:
        base = old_by_t.get(round(f["t"], 2))
        if base is None:
            print(f"  t={f['t']:6.2f}s  NEW (not in manifest — run --update to guard it)")
        elif base != f["sha"]:
            drift.append(f["t"])
            print(f"  t={f['t']:6.2f}s  DRIFT  ({base[:12]} -> {f['sha'][:12]})")
        else:
            print(f"  t={f['t']:6.2f}s  ok  ({f['sha'][:12]})")
    missing = sorted(set(old_by_t) - {round(f["t"], 2) for f in frames})
    if missing:
        print(f"  manifest times not re-rendered: {missing}")
    if drift:
        print(f"\n[regression] DRIFT on {len(drift)} frame(s): {drift}")
        print("  if the change is intentional, re-baseline: rerun with --update")
        sys.exit(1)
    print("\n[regression] PASS — all guarded frames byte-identical.")


if __name__ == "__main__":
    main()
