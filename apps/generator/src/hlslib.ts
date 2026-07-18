/**
 * Chain acrossfade pairwise: [0][1]→a1, [a1][2]→a2, … producing one
 * continuous stream with `crossfadeSec` overlap at each boundary.
 */
export function buildCrossfadeFilter(
  trackCount: number,
  crossfadeSec: number,
): string {
  if (trackCount < 2) return "";
  const parts: string[] = [];
  let prev = "0:a";
  for (let i = 1; i < trackCount; i++) {
    const label = i === trackCount - 1 ? "out" : `a${i}`;
    parts.push(
      `[${prev}][${i}:a]acrossfade=d=${crossfadeSec}:c1=tri:c2=tri[${label}]`,
    );
    prev = label;
  }
  return parts.join(";");
}
