#!/usr/bin/env python3
"""Frame-by-frame renderer for pages that expose window.render(t).

The page must define `window.render = (t) => {...}` that draws the frame at t seconds.
Optionally it can set `window.ready = false` while loading assets and flip it to true.

Examples
  still:   render.py page.html shot.png --still 2.5 --size 1920x1080
  video:   render.py page.html out.mp4 --size 1920x1080 --fps 30 --duration 12 --audio mix.wav
  blur:    render.py page.html out.mp4 --size 1440x1440 --fps 60 --duration 14 --subframes 4
  segment: render.py page.html seg.mp4 --size 1920x1080 --fps 30 --start 8 --duration 4
Query strings are allowed: render.py "page.html?raw=1" out.mp4 ...

Audio is padded (apad) and capped at the video length — a short music/vo file no
longer truncates the film. Page JS errors abort the render with the frame number,
the failing time, and the captured console/page errors.
"""
import argparse, pathlib, subprocess, sys, time

from playwright.sync_api import sync_playwright

GPU_ARGS = ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
if sys.platform == "darwin":
    GPU_ARGS.append("--use-angle=metal")


def launch(p):
    """Prefer Playwright's own Chromium; fall back to an installed Chrome / Edge."""
    errors = []
    for kw in ({}, {"channel": "chrome"}, {"channel": "msedge"}):
        try:
            return p.chromium.launch(headless=True, args=GPU_ARGS, **kw)
        except Exception as e:  # try the next browser
            errors.append(f"{kw or 'bundled chromium'}: {str(e).splitlines()[0]}")
    sys.exit("No usable browser. Run `python3 -m playwright install chromium` or install Google Chrome.\n" + "\n".join(errors))


def page_url(arg):
    path, _, query = arg.partition("?")
    return pathlib.Path(path).resolve().as_uri() + (f"?{query}" if query else "")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page"); ap.add_argument("out")
    ap.add_argument("--size", default="1920x1080", help="WIDTHxHEIGHT")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--duration", type=float, help="seconds to render (video mode)")
    ap.add_argument("--start", type=float, default=0.0, help="first second to render")
    ap.add_argument("--still", type=float, help="render a single PNG at this time")
    ap.add_argument("--subframes", type=int, default=1, help="samples per frame blended into motion blur")
    ap.add_argument("--audio", help="audio file to mux (padded/truncated to the video length)")
    ap.add_argument("--crf", type=int, default=16)
    a = ap.parse_args()
    W, H = map(int, a.size.lower().split("x"))

    with sync_playwright() as p:
        browser = launch(p)
        pg = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        js_errors = []
        pg.on("pageerror", lambda e: js_errors.append(str(e).splitlines()[0]))
        pg.on("console", lambda m: js_errors.append(m.text) if m.type == "error" else None)
        pg.goto(page_url(a.page))
        pg.wait_for_function("typeof window.render === 'function' && (window.ready === undefined || window.ready === true)", timeout=60000)
        pg.evaluate("document.fonts ? document.fonts.ready.then(() => true) : true")

        if a.still is not None:
            try:
                pg.evaluate("t => window.render(t)", a.still)
                pg.screenshot(path=a.out, type="png")
            except Exception as e:
                detail = js_errors[-1] if js_errors else str(e).splitlines()[0]
                sys.exit(f"[render] still t={a.still}s failed: {detail}")
            print(f"{a.out}: still at t={a.still}s")
            browser.close(); return

        if not a.duration:
            sys.exit("--duration is required for video output")
        sub = max(1, a.subframes)
        frames = round(a.fps * a.duration)
        blur = f"tmix=frames={sub}:weights={' '.join(['1'] * sub)},select='not(mod(n\\,{sub}))'," if sub > 1 else ""
        cmd = ["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(a.fps * sub), "-i", "-"]
        if a.audio:
            cmd += ["-ss", str(a.start), "-i", a.audio]
        cmd += ["-vf", f"{blur}setpts=N/({a.fps}*TB),format=yuv420p", "-r", str(a.fps), "-c:v", "libx264", "-crf", str(a.crf)]
        if a.audio:
            # pad short audio with silence and cap at the video length — never
            # let a short WAV truncate the film (the old -shortest footgun)
            cmd += ["-c:a", "aac", "-b:a", "192k", "-af", "apad", "-t", f"{frames / a.fps:.6f}"]
        cmd.append(a.out)
        ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)

        t0 = time.time()
        total = frames * sub
        failed = None
        for i in range(total):
            t = a.start + i / (a.fps * sub)
            try:
                pg.evaluate("t => window.render(t)", t)
                ff.stdin.write(pg.screenshot(type="png"))
            except Exception as e:
                failed = (i, t, e)
                break
            if i and i % max(1, total // 10) == 0:
                rate = i / max(1e-9, time.time() - t0)
                eta = (total - i) / rate if rate > 0 else 0
                print(f"  {i}/{total} samples ({i * 100 // total}%), {rate:.1f} samp/s, ETA {eta:.0f}s", flush=True)

        if failed is not None:
            i, t, e = failed
            frame_no = round(t * a.fps)
            detail = js_errors[-1] if js_errors else str(e).splitlines()[0]
            ff.stdin.close()
            try: ff.terminate(); ff.wait(timeout=5)
            except Exception: ff.kill()
            browser.close()
            sys.exit(
                f"\n[render] FAILED at frame {frame_no} (t={t:.3f}s, sample {i + 1}/{total}): {detail}\n"
                + (f"  recent page errors: {js_errors[-3:]}" if js_errors else "  (no console/page errors captured — check render(t) for invalid state)")
            )
        if js_errors:
            print(f"[warn] page raised {len(js_errors)} error(s) during render; last: {js_errors[-1]}", flush=True)
        browser.close()
    ff.stdin.close()
    if ff.wait() != 0:
        sys.exit("ffmpeg failed")
    print(f"{a.out}: {frames} frames x {sub} samples, {a.size} @ {a.fps}fps, rendered in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
