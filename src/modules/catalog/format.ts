export function formatCapacity(max?: number | null, seated?: number | null) {
  if (max && max > 0) return `Up to ${max.toLocaleString()} guests`;
  if (seated && seated > 0) return `${seated.toLocaleString()} seated`;
  return null;
}

export function formatHallroomCount(count: number) {
  return count === 1 ? "1 ballroom" : `${count} ballrooms`;
}
