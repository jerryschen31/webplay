export interface Channel {
  id: string;
  label: string;
  streamUrl: string;
  background: string;
}

const LOFI: Channel = {
  id: "lofi",
  label: "Lofi Beats for Study",
  streamUrl: "https://stream.webplay.io/stream/lofi/playlist.m3u8",
  background: "/backgrounds/lofi-beats-1.jpg",
};

export const CHANNELS: Channel[] = [
  LOFI,
  {
    id: "sleep",
    label: "Calm Music for Sleep",
    streamUrl: "https://stream.webplay.io/stream/sleep/playlist.m3u8",
    background: "/backgrounds/calm-sleep-1.jpg",
  },
  {
    id: "jazz",
    label: "Jazz for Lounging",
    streamUrl: "https://stream.webplay.io/stream/jazz/playlist.m3u8",
    background: "/backgrounds/jazz-1.jpg",
  },
  {
    id: "cafe",
    label: "Cafe for Reading",
    streamUrl: "https://stream.webplay.io/stream/cafe/playlist.m3u8",
    background: "/backgrounds/coffee-shop-2.jpg",
  },
];

export const DEFAULT_CHANNEL: Channel = LOFI;
