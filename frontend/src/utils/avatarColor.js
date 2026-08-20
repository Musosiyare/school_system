// Deterministic pastel color for a person's avatar circle, based on their
// name — so each person gets a consistent, distinguishable color across
// sessions without needing to store anything. Originally lived only in
// MarksEntry.jsx; pulled out here so other pages (Reports, PastYears, …)
// can reuse the exact same palette/logic instead of re-implementing it.
const AVATAR_COLORS = [
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-sky-100", text: "text-sky-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-orange-100", text: "text-orange-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-lime-100", text: "text-lime-700" },
];

export function avatarColorFor(name) {
  let hash = 0;
  const str = name || "";
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// "Jean Paul Uwimana" -> "JU" (first + last initial); single-word names ->
// first two letters ("Aisha" -> "AI").
export function initialsFor(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
