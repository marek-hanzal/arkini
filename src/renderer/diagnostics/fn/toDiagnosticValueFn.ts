import type { DiagnosticValue } from "../../../../electron/contract/diagnostics/DiagnosticRecord";

/** Converts unknown failures and Effect/Pixi objects into a bounded JSON-safe diagnostic value. */
export const toDiagnosticValueFn = (
	value: unknown,
	depth = 0,
	seen = new WeakSet<object>(),
): DiagnosticValue => {
	if (value === null || typeof value === "boolean" || typeof value === "string") {
		return typeof value === "string" ? value.slice(0, 8_192) : value;
	}
	if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
	if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
		return String(value);
	}
	if (typeof value !== "object") return String(value);
	if (seen.has(value)) return "[Circular]";
	if (depth >= 6) return `[${value.constructor?.name ?? "Object"}]`;
	seen.add(value);

	if (value instanceof Error) {
		const error: Record<string, DiagnosticValue> = {
			name: value.name,
			message: value.message.slice(0, 8_192),
			...(value.stack === undefined
				? {}
				: {
						stack: value.stack.slice(0, 8_192),
					}),
		};
		if ("cause" in value && value.cause !== undefined) {
			error.cause = toDiagnosticValueFn(value.cause, depth + 1, seen);
		}
		if (value instanceof AggregateError) {
			error.errors = Array.from(value.errors)
				.slice(0, 20)
				.map((cause) => toDiagnosticValueFn(cause, depth + 1, seen));
		}
		for (const key of Object.keys(value).slice(0, 100)) {
			if (
				key === "name" ||
				key === "message" ||
				key === "stack" ||
				key === "cause" ||
				key === "errors"
			) {
				continue;
			}
			try {
				// Custom Error fields are diagnostic roots. Their surrounding Cause/Error wrappers
				// must not spend the depth budget before domain details such as runtime issues.
				error[key.slice(0, 100)] = toDiagnosticValueFn(
					(value as unknown as Record<string, unknown>)[key],
					0,
					seen,
				);
			} catch (cause) {
				error[key.slice(0, 100)] = `[Unreadable: ${String(cause)}]`;
			}
		}
		return error;
	}
	if (Array.isArray(value)) {
		return value.slice(0, 100).map((entry) => toDiagnosticValueFn(entry, depth + 1, seen));
	}

	const result: Record<string, DiagnosticValue> = {};
	for (const key of Object.keys(value).slice(0, 100)) {
		try {
			result[key.slice(0, 100)] = toDiagnosticValueFn(
				(value as Record<string, unknown>)[key],
				depth + 1,
				seen,
			);
		} catch (cause) {
			result[key.slice(0, 100)] = `[Unreadable: ${String(cause)}]`;
		}
	}
	return result;
};
