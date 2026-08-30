export function nextStreamingText(current: string, target: string) {
  if (!target.startsWith(current)) return target;
  const remaining = target.length - current.length;
  if (remaining <= 0) return current;
  const step = Math.min(12, Math.max(2, Math.ceil(remaining / 24)));
  return target.slice(0, current.length + step);
}
