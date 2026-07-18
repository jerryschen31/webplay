"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";

const STREAM_URL = "https://stream.webplay.io/stream/lofi/playlist.m3u8";
const FADE_OUT_SECONDS = 2;

/** Linear fade over the final FADE_OUT_SECONDS: 1 → 0 at track end. */
export function fadeVolumeFor(remainingSec: number): number {
  return Math.min(1, Math.max(0, remainingSec / FADE_OUT_SECONDS));
}

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(STREAM_URL);
      hls.attachMedia(audio);
      return () => hls.destroy();
    }
    if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = STREAM_URL; // Safari native HLS
    }
    return undefined;
  }, []);

  // The milestone-0 rotation is a finite VOD playlist; loop it so the
  // channel feels continuous until live Liquidsoap mixing replaces it.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      audio.currentTime = 0;
      audio.volume = 1; // undo the end-of-rotation fade
      // If the browser blocks the replay (autoplay/visibility policy),
      // reflect reality in the UI instead of a stale "playing" state.
      audio.play().catch(() => setPlaying(false));
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  // Fade fully out over the rotation's final seconds so the loop back
  // to the top feels like a deliberate restart, not a hard splice.
  // (iOS Safari ignores programmatic volume — it gets a hard loop until
  // the WebAudio/visualizer work gives us a GainNode to ramp instead.)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let raf = 0;
    const stopRamp = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const ramp = () => {
      const remaining = audio.duration - audio.currentTime;
      if (!Number.isFinite(remaining) || audio.paused) {
        stopRamp();
        return;
      }
      if (remaining > FADE_OUT_SECONDS + 0.5) {
        // user seeked away from the ending; restore and stand down
        audio.volume = 1;
        stopRamp();
        return;
      }
      audio.volume = fadeVolumeFor(remaining);
      raf = requestAnimationFrame(ramp);
    };
    const onTimeUpdate = () => {
      const remaining = audio.duration - audio.currentTime;
      if (
        raf === 0 &&
        !audio.paused &&
        Number.isFinite(remaining) &&
        remaining <= FADE_OUT_SECONDS + 0.5
      ) {
        raf = requestAnimationFrame(ramp);
      }
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      stopRamp();
    };
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      // play() returns a promise; if the browser blocks it (no user
      // gesture yet), stay in the paused state instead of lying.
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }, [playing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" && event.target === document.body) {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: music stream has no captions */}
      <audio ref={audioRef} preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        style={{
          width: "6rem",
          height: "6rem",
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.8)",
          background: playing
            ? "rgba(255,255,255,0.25)"
            : "rgba(255,255,255,0.12)",
          color: "#fff",
          fontSize: "2rem",
          cursor: "pointer",
          backdropFilter: "blur(6px)",
          transition: "background 200ms ease, transform 150ms ease",
        }}
      >
        {playing ? "❚❚" : "▶"}
      </button>
    </>
  );
}
