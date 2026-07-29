import { Effect } from "effect";

import type {
	DiagnosticRecord,
	DiagnosticValue,
} from "../../../electron/contract/diagnostics/DiagnosticRecord";

let warnedAboutDiagnosticFailure = false;

const reportDiagnosticFailure = (cause: unknown) => {
	if (warnedAboutDiagnosticFailure) return;
	warnedAboutDiagnosticFailure = true;
	console.warn("Arkini diagnostics are unavailable.", cause);
};

/**
 * Converts unknown failures and Effect/Pixi objects into a bounded JSON-safe diagnostic value.
 * Diagnostic logging must never throw while handling the failure it is trying to preserve.
 */
export const toDiagnosticValue = (
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
			message: value.message,
			...(value.stack === undefined
				? {}
				: {
						stack: value.stack.slice(0, 8_192),
					}),
		};
		if ("cause" in value && value.cause !== undefined) {
			error.cause = toDiagnosticValue(value.cause, depth + 1, seen);
		}
		if (value instanceof AggregateError) {
			error.errors = Array.from(value.errors)
				.slice(0, 20)
				.map((cause) => toDiagnosticValue(cause, depth + 1, seen));
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
				error[key.slice(0, 100)] = toDiagnosticValue(
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
		return value.slice(0, 100).map((entry) => toDiagnosticValue(entry, depth + 1, seen));
	}

	const result: Record<string, DiagnosticValue> = {};
	for (const key of Object.keys(value).slice(0, 100)) {
		try {
			result[key.slice(0, 100)] = toDiagnosticValue(
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

/** Fire-and-forget renderer edge. Logger failures are deliberately isolated from gameplay. */
export const writeDiagnosticRecord = (record: Omit<DiagnosticRecord, "schemaVersion">): void => {
	try {
		const diagnostics = window.arkini?.diagnostics;
		if (diagnostics === undefined) return;
		void diagnostics
			.write({
				schemaVersion: 1,
				...record,
			})
			.catch(reportDiagnosticFailure);
	} catch (cause) {
		reportDiagnosticFailure(cause);
	}
};

export const openDiagnosticDirectoryFx = Effect.fn("openDiagnosticDirectoryFx")(() =>
	Effect.tryPromise({
		try: () => window.arkini.diagnostics.openDirectory(),
		catch: (cause) => cause,
	}),
);
