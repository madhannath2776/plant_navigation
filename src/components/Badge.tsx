interface BadgeProps {
  count: number;
}

const BADGES = [
  { min: 50, icon: "🏆", label: "Biodiversity Champion" },
  { min: 25, icon: "🌳", label: "Plant Hunter" },
  { min: 10, icon: "🌿", label: "Green Explorer" },
  { min: 5, icon: "🌱", label: "Plant Starter" },
];

export function getBadge(count: number) {
  return BADGES.find((b) => count >= b.min) ?? null;
}

export function BadgeList({ count }: BadgeProps) {
  const earned = BADGES.filter((b) => count >= b.min);
  if (!earned.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {earned.map((b) => (
        <span
          key={b.label}
          title={b.label}
          className="text-xs bg-[#fefae0] text-[#5a4000] border border-[#ffd166] px-2 py-0.5 rounded-full"
        >
          {b.icon} {b.label}
        </span>
      ))}
    </div>
  );
}

export default BadgeList;
