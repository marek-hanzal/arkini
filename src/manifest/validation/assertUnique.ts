import { assert } from "./assert";

export const assertUnique = <T>(set: Set<T>, value: T, label: string) => {
	assert(!set.has(value), `Duplicate ${label}: ${String(value)}`);
	set.add(value);
};
