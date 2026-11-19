#!/usr/bin/env python3
"""video-forge mixdown: auto-duck music under narration + sfx → loudnorm -14 LUFS

用法:
  python mixdown.py --music music.wav --vo vo.wav --sfx sfx.wav --out mix.wav
                    [--duck 0.5] [--sfx-gain 0.85] [--vo-gain 1.0] [--lufs -14]

- 音乐自动闪避：按旁白包络实时压低（旁白响起时音乐压到 --duck 倍率，松开恢复），
  200ms 平滑，不会一惊一乍。
- 三个输入任意缺省；输出长度 = 各输入最长者（不足静音补齐）。
- 末级 ffmpeg loudnorm（I=-14:TP=-1.0:LRA=11 线性模式）。
"""
import argparse, os, subprocess, sys
import numpy as np
import wave

SR = 48000

def load(f):
    if not f or not os.path.exists(f):
        return None
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", f, "-f", "s16le",
                                   "-acodec", "pcm_s16le", "-ac", "1", "-ar", str(SR), "-"])
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32767

def save(f, x):
    w = wave.open(f, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()

def envelope(x, win_s=0.05):
    n = len(x); env = np.zeros(n)
    w = max(1, int(win_s * SR))
    sq = np.abs(x)
    c = np.cumsum(np.insert(sq, 0, 0))
    mov = (c[w:] - c[:-w]) / w
    env[w:] = mov[: n - w]
    env[:w] = mov[0] if len(mov) else 0
    m = env.max() or 1.0
    return np.clip(env / m, 0, 1)

def smooth(x, sec=0.2):
    k = max(1, int(sec * SR))
    ker = np.ones(k) / k
    return np.convolve(x, ker, mode="same")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--music"); ap.add_argument("--vo"); ap.add_argument("--sfx")
    ap.add_argument("--out", required=True)
    ap.add_argument("--duck", type=float, default=0.5)
    ap.add_argument("--music-gain", type=float, default=1.0)
    ap.add_argument("--sfx-gain", type=float, default=0.85)
    ap.add_argument("--vo-gain", type=float, default=1.0)
    ap.add_argument("--lufs", type=float, default=-14)
    a = ap.parse_args()

    tracks = {k: load(getattr(a, k)) for k in ("music", "vo", "sfx")}
    have = {k: v for k, v in tracks.items() if v is not None}
    if not have:
        sys.exit("至少需要一个输入")
    n = max(len(v) for v in have.values())
    mix = np.zeros(n)

    if tracks["music"] is not None:
        m = np.zeros(n); m[:len(tracks["music"])] = tracks["music"]
        if tracks["vo"] is not None:
            env = smooth(envelope(tracks["vo"], 0.05), 0.2)
            env = np.pad(env, (0, max(0, n - len(env))))[:n]
            gain = 1 - (1 - a.duck) * env
            m *= gain * a.music_gain
        else:
            m *= a.music_gain
        mix += m
    if tracks["vo"] is not None:
        mix[:len(tracks["vo"])] += tracks["vo"] * a.vo_gain
    if tracks["sfx"] is not None:
        s = np.zeros(n); s[:len(tracks["sfx"])] = tracks["sfx"]
        mix += s * a.sfx_gain

    tmp = a.out + ".pre.wav"
    save(tmp, mix)
    i_target = a.lufs
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp,
                    "-af", f"loudnorm=I={i_target}:TP=-1.0:LRA=11", a.out], check=True)
    os.remove(tmp)
    d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", a.out]).strip())
    print(f"[mixdown] {a.out}  {d:.2f}s  loudnorm I={i_target} TP=-1.0")

if __name__ == "__main__":
    main()
