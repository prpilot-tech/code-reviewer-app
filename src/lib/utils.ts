import { clsx, type ClassValue } from "clsx"
import dayjs from "dayjs"
import { twMerge } from "tailwind-merge"

/**
 * Merges class names with `clsx`, then resolves Tailwind conflicts with `twMerge`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a byte count as a human-readable string (e.g. `1536` -> `"1.5 KB"`).
 */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB"]
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Formats a UNIX timestamp (seconds) as a short relative time string
 * (e.g. `"3h ago"`, `"just now"`).
 */
export function formatRelativeTime(timestampSeconds: number) {
  const diffSeconds = dayjs().diff(dayjs.unix(timestampSeconds), "second")
  const units: [string, number][] = [
    ["y", 60 * 60 * 24 * 365],
    ["mo", 60 * 60 * 24 * 30],
    ["d", 60 * 60 * 24],
    ["h", 60 * 60],
    ["m", 60],
  ]
  for (const [label, secondsPerUnit] of units) {
    const value = Math.floor(diffSeconds / secondsPerUnit)
    if (value >= 1) return `${value}${label} ago`
  }
  return "just now"
}

/**
 * Formats a UNIX timestamp (seconds) as an exact date and time
 * (e.g. `"Jan 5, 2026 10:32 AM"`).
 */
export function formatExactDate(timestampSeconds: number) {
  return dayjs.unix(timestampSeconds).format("MMM D, YYYY h:mm A")
}
