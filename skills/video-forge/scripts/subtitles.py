#!/usr/bin/env python3
"""video-forge subtitles: vo_timeline.json → SRT (optional ASS for burning)

用法:
  python subtitles.py audio/vo_timeline.json --out subs.srt [--srt-shift 0.0]
  python subtitles.py audio/vo_timeline.json --ass subs.ass --ass-style height

说明:
  - 画面内字幕（推荐，样式随片）由 fx-lib.js 的 installCaptions 直接吃
    vo_timeline.json，无需转换；本脚本用于外挂/平台上传场景。
  - --srt-shift 可整体平移（秒，负值提前）。
  - 长句自动按标点切成 ≤16 字的分行，避免超宽。
"""
import argparse, json, re

def fmt_srt(t):
    h = int(t // 3600); m = int(t % 3600 // 60); s = int(t % 60)
    ms = int(round((t - int(t)) * 1000))
    if ms == 1000: ms = 0; s += 1
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def split_line(text, maxlen=16):
    parts = re.split(r"(?<=[，。！？；：、—…])", text)
    out, buf = [], ""
    for p in parts:
        if len(buf + p) > maxlen and buf:
            out.append(buf); buf = p
        else:
            buf += p
    if buf: out.append(buf)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("timeline")
    ap.add_argument("--out", default="subs.srt")
    ap.add_argument("--srt-shift", type=float, default=0.0)
    ap.add_argument("--ass", help="同时输出 ASS（烧录用）")
    a = ap.parse_args()

    tl = json.load(open(a.timeline, encoding="utf-8"))
    lines = tl["lines"] if "lines" in tl else tl

    srt = []
    for i, e in enumerate(lines, 1):
        st = e["start"] + a.srt_shift; en = e["end"] + a.srt_shift
        parts = split_line(e["text"])
        seg_d = (en - st) / max(1, len(parts))
        for j, p in enumerate(parts):
            srt.append(f"{i}-{j+1}\n{fmt_srt(st + j * seg_d)} --> {fmt_srt(st + (j+1) * seg_d)}\n{p.strip()}\n")
    open(a.out, "w", encoding="utf-8-sig").write("\n".join(srt))
    print(f"[srt] {a.out}  {len(lines)} 句")

    if a.ass:
        playres = "1920 1080"
        ass = ["[Script Info]", "ScriptType: v4.00+", f"PlayResX: {playres.split()[0]}", f"PlayResY: {playres.split()[1]}",
               "", "[V4+ Styles]",
               "Format: Name,Fontname,Fontsize,PrimaryColour,OutlineColour,BackColour,Bold,Outline,Shadow,Alignment,MarginV",
               "Style: XVP,'Microsoft YaHei',54,&H00FFFFFF,&H00140804,&H80000000,-1,3,1,2,60",
               "", "[Events]",
               "Format: Layer,Start,End,Style,Text"]
        for e in lines:
            st = e["start"] + a.srt_shift; en = e["end"] + a.srt_shift
            def hms(t):
                h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
                return f"{h}:{m:02d}:{s:05.2f}"
            txt = e["text"].replace("\n", "\\N")
            ass.append(f"Dialogue: 0,{hms(st)},{hms(en)},XVP,,0,0,0,,{txt}")
        open(a.ass, "w", encoding="utf-8-sig").write("\n".join(ass))
        print(f"[ass] {a.ass}")
        print(f"[burn] ffmpeg -i out/final.mp4 -vf \"ass={a.ass}\" -c:a copy out/subbed.mp4")

if __name__ == "__main__":
    main()
