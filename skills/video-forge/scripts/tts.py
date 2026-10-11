#!/usr/bin/env python3
"""video-forge narration pipeline：edge-tts line-by-line synthesis → measured timeline → vo.wav

用法:
  python tts.py --script narration.txt --outdir audio [--voice zh-CN-YunxiNeural]
                [--rate +10%] [--gap 0.22] [--start 0.18] [--pitch +0Hz]

narration.txt 格式：一行一句；# 开头为注释；空行额外加 0.35s 停顿；
行内可用 -- 分隔强制微停顿（edge-tts 自行处理标点停顿，通常无需手写）。

产物:
  audio/vo_01.mp3 ... 逐句音频
  audio/vo_timeline.json  {"lines":[{i,name,text,start,end}], "total", "voice", "rate"}
  audio/vo.wav            按时间轴拼好的完整旁白 (48k mono 16bit)
  同时打印建议切点（每句 end），分镜切点必须落在这些时刻（±0.1s 内取整到 0.05s）。

依赖: pip install edge-tts ；ffmpeg 在 PATH。
"""
import argparse, asyncio, json, os, subprocess, sys
import numpy as np

def ffprobe_dur(f):
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", f]).strip())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True, help="旁白稿 txt，一行一句")
    ap.add_argument("--outdir", default="audio")
    ap.add_argument("--voice", default="zh-CN-YunxiNeural")
    ap.add_argument("--rate", default="+10%")
    ap.add_argument("--pitch", default="+0Hz")
    ap.add_argument("--gap", type=float, default=0.22, help="句间停顿(秒)")
    ap.add_argument("--start", type=float, default=0.18, help="首句起始(秒)")
    ap.add_argument("--sr", type=int, default=48000)
    a = ap.parse_args()

    try:
        import edge_tts
    except ImportError:
        sys.exit("缺少 edge-tts：python -m pip install edge-tts")

    os.makedirs(a.outdir, exist_ok=True)
    lines = []
    for raw in open(a.script, encoding="utf-8"):
        raw = raw.strip()
        if not raw:
            if lines: lines.append({"pause": 0.35})
            continue
        if raw.startswith("#"):
            continue
        lines.append({"text": raw})

    async def gen():
        for i, ln in enumerate(lines, 1):
            if "text" not in ln: continue
            name = f"vo_{i:02d}"
            ln["name"] = name
            mp3 = os.path.join(a.outdir, name + ".mp3")
            tts = edge_tts.Communicate(ln["text"], a.voice, rate=a.rate, pitch=a.pitch)
            await tts.save(mp3)
            ln["dur"] = round(ffprobe_dur(mp3), 3)
            print(f"  {name}  {ln['dur']:6.2f}s  {ln['text']}", flush=True)

    print(f"[tts] voice={a.voice} rate={a.rate}")
    asyncio.run(gen())

    # 时间轴
    t = a.start; out = []; extra = 0.0
    for ln in lines:
        if "text" not in ln:
            extra += ln["pause"]; continue
        start = t + extra
        e = {"i": len(out) + 1, "name": ln["name"], "text": ln["text"],
             "start": round(start, 2), "end": round(start + ln["dur"], 2)}
        out.append(e)
        t = e["end"] + a.gap; extra = 0.0
    total = round(out[-1]["end"] + 0.9, 2)  # 留 0.9s 收尾余量
    meta = {"voice": a.voice, "rate": a.rate, "gap": a.gap,
            "lines": out, "total": total,
            "suggested_cuts": [e["end"] for e in out]}
    json.dump(meta, open(os.path.join(a.outdir, "vo_timeline.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    # 拼 vo.wav
    SR = a.sr
    buf = np_zeros(int(SR * (out[-1]["end"] + 0.5)))
    for e in out:
        raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i",
            os.path.join(a.outdir, e["name"] + ".mp3"), "-f", "s16le",
            "-acodec", "pcm_s16le", "-ac", "1", "-ar", str(SR), "-"])
        seg = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32767
        i = int(e["start"] * SR); j = min(len(buf), i + len(seg))
        buf[i:j] += seg[: j - i]
    import wave
    w = wave.open(os.path.join(a.outdir, "vo.wav"), "wb")
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(buf, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()

    print(f"\n[timeline] 总时长 {total}s（含 0.9s 收尾）")
    for e in out:
        print(f"  #{e['i']}  {e['start']:6.2f} -> {e['end']:6.2f}   {e['text']}")
    print(f"[cuts] 建议切点: {meta['suggested_cuts']}")
    print(f"[rule] 视频时长 >= {total}s；分镜切点取句尾，画面进场可提前 0.15-0.25s 叠化")

def np_zeros(n):
    return np.zeros(n)

if __name__ == "__main__":
    main()
