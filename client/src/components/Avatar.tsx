const PALETTE = [
  "#f87171", "#fb923c", "#facc15", "#4ade80",
  "#34d399", "#22d3ee", "#60a5fa", "#818cf8",
  "#a78bfa", "#e879f9", "#f472b6", "#fb7185",
];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface Props {
  name: string;
  size?: number;
  online?: boolean;
}

export default function Avatar({ name, size = 36, online }: Props) {
  const dotSize = Math.max(7, Math.round(size * 0.27));
  return (
    <div className="avatar-wrap" style={{ width: size, height: size }}>
      <div
        className="avatar"
        style={{
          width: size,
          height: size,
          background: colorFor(name),
          fontSize: Math.round(size * 0.38),
        }}
        title={name}
      >
        {initials(name)}
      </div>
      {online !== undefined && (
        <div
          className={`avatar-dot ${online ? "avatar-dot--online" : "avatar-dot--offline"}`}
          style={{ width: dotSize, height: dotSize }}
        />
      )}
    </div>
  );
}
