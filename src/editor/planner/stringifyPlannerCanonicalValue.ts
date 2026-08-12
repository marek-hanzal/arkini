const normalizePlannerCanonicalValue = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(normalizePlannerCanonicalValue);
	if (value === null || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => [
				key,
				normalizePlannerCanonicalValue(entry),
			]),
	);
};

/** Stable JSON representation for planner keys whose object property order is irrelevant. */
export const stringifyPlannerCanonicalValue = (value: unknown) =>
	JSON.stringify(normalizePlannerCanonicalValue(value));
