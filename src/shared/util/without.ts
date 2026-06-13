export function without<T>(set: ReadonlySet<T>, value: T) {
	const next = new Set(set);
	next.delete(value);
	return next;
}
