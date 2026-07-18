import { ChannelShell } from "../components/ChannelShell";

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
      <ChannelShell />
    </main>
  );
}
