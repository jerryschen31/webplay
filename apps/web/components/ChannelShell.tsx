"use client";

import { useState } from "react";
import { CHANNELS, DEFAULT_CHANNEL } from "../lib/channels";
import { AudioPlayer } from "./AudioPlayer";

export function ChannelShell() {
  const [channel, setChannel] = useState(DEFAULT_CHANNEL);

  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `url(${channel.background})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          zIndex: -2,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background:
            "linear-gradient(rgba(10, 8, 18, 0.35), rgba(10, 8, 18, 0.55))",
          zIndex: -1,
        }}
      />
      <div style={{ textAlign: "center", color: "#fff", padding: "2rem" }}>
        <h1
          style={{
            fontSize: "3rem",
            marginBottom: "0.25rem",
            textShadow: "0 2px 12px rgba(0,0,0,0.5)",
          }}
        >
          webplay
        </h1>
        <p
          style={{
            marginBottom: "1.25rem",
            opacity: 0.85,
            textShadow: "0 1px 8px rgba(0,0,0,0.5)",
          }}
        >
          AI radio, always on.
        </p>
        <select
          aria-label="Channel"
          value={channel.id}
          onChange={(event) =>
            setChannel(
              CHANNELS.find((c) => c.id === event.target.value) ??
                DEFAULT_CHANNEL,
            )
          }
          style={{
            marginBottom: "2.5rem",
            padding: "0.5rem 1.25rem",
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.4)",
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
            backdropFilter: "blur(6px)",
            fontSize: "0.9rem",
            cursor: "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            textAlign: "center",
          }}
        >
          {CHANNELS.map((c) => (
            <option key={c.id} value={c.id} style={{ color: "#000" }}>
              {c.label}
            </option>
          ))}
        </select>
        <div>
          {/* key remounts the player on switch so the <audio> element and
              hls.js instance start fresh on the new stream */}
          <AudioPlayer key={channel.id} streamUrl={channel.streamUrl} />
        </div>
      </div>
    </>
  );
}
