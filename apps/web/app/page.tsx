import { AudioPlayer } from "../components/AudioPlayer";

export default function Home() {
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: "url(/backgrounds/lofi-beats-1.jpg)",
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
            marginBottom: "2.5rem",
            opacity: 0.85,
            textShadow: "0 1px 8px rgba(0,0,0,0.5)",
          }}
        >
          Lofi beats for study — AI radio, always on.
        </p>
        <AudioPlayer />
      </div>
    </main>
  );
}
