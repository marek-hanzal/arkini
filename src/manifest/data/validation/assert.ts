export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertUnique<T>(set: Set<T>, value: T, label: string) {
  assert(!set.has(value), `Duplicate ${label}: ${String(value)}`);
  set.add(value);
}
