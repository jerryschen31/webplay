"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useRef, useState } from "react";

const STREAM_URL = "https://stream.webplay.io/stream/lofi/playlist.m3u8";

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
      void audio.play();
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
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
