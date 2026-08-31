import type { DiagnosticValue } from "../../../electron/contract/diagnostics/DiagnosticRecord";

const maxDiagnosticScalarLength = 8_192;
const maxDiagnosticSerializedLength = 48 * 1_024;
const maxDiagnosticDepth = 6;
const maxDiagnosticEntries = 100;

type DiagnosticBudget = {
	remaining: number;
};

const toDiagnosticStringFn = (value: string, budget: DiagnosticBudget): string => {
	const scalar = value.slice(0, maxDiagnosticScalarLength);
	const serialized = JSON.stringify(scalar);
	if (serialized.length <= budget.remaining) {
		budget.remaining -= serialized.length;
		return scalar;
	}

	let lowerLength = 0;
	let upperLength = scalar.length;
	while (lowerLength < upperLength) {
		const candidateLength = Math.ceil((lowerLength + upperLength) / 2);
		if (JSON.stringify(scalar.slice(0, candidateLength)).length <= budget.remaining) {
			lowerLength = candidateLength;
		} else {
			upperLength = candidateLength - 1;
		}
	}
	const bounded = scalar.slice(0, lowerLength);
	budget.remaining -= JSON.stringify(bounded).length;
	return bounded;
};

const toUnreadableDiagnosticValueFn = (
	cause: unknown,
	budget: DiagnosticBudget,
): DiagnosticValue => {
	try {
		return toDiagnosticStringFn(`[Unreadable: ${String(cause)}]`, budget);
	} catch {
		return toDiagnosticStringFn("[Unreadable]", budget);
	}
};

const createDiagnosticRecordFn = (): Record<string, DiagnosticValue> =>
	Object.create(null) as Record<string, DiagnosticValue>;

const toDiagnosticValueAtDepthFn = (
	value: unknown,
	depth: number,
	seen: WeakSet<object>,
	budget: DiagnosticBudget,
): DiagnosticValue => {
	const startingBudget = budget.remaining;
	try {
		if (typeof value === "string") return toDiagnosticStringFn(value, budget);
		if (value === null || typeof value === "boolean") {
			const serializedLength = JSON.stringify(value).length;
			if (serializedLength > budget.remaining) return toDiagnosticStringFn("", budget);
			budget.remaining -= serializedLength;
			return value;
		}
		if (typeof value === "number") {
			if (!Number.isFinite(value)) return toDiagnosticStringFn(String(value), budget);
			const serializedLength = JSON.stringify(value).length;
			if (serializedLength > budget.remaining) return toDiagnosticStringFn("", budget);
			budget.remaining -= serializedLength;
			return value;
		}
		if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
			return toDiagnosticStringFn(String(value), budget);
		}
		if (typeof value !== "object") return toDiagnosticStringFn(String(value), budget);
		if (seen.has(value)) return toDiagnosticStringFn("[Circular]", budget);
		if (depth >= maxDiagnosticDepth) {
			return toDiagnosticStringFn(`[${value.constructor?.name ?? "Object"}]`, budget);
		}
		seen.add(value);

		if (value instanceof Error) {
			const error = createDiagnosticRecordFn();
			let entryCount = 0;
			budget.remaining -= 2;
			const appendEntryFn = (key: string, readValueFn: () => DiagnosticValue): boolean => {
				const boundedKey = key.slice(0, 100);
				const entryOverhead =
					(entryCount === 0 ? 0 : 1) + JSON.stringify(boundedKey).length + 1;
				if (budget.remaining < entryOverhead + 2) return false;
				budget.remaining -= entryOverhead;
				error[boundedKey] = readValueFn();
				entryCount += 1;
				return true;
			};

			appendEntryFn("name", () => toDiagnosticStringFn(value.name, budget));
			appendEntryFn("message", () => toDiagnosticStringFn(value.message, budget));
			if (value.stack !== undefined) {
				appendEntryFn("stack", () => toDiagnosticStringFn(value.stack ?? "", budget));
			}
			if ("cause" in value && value.cause !== undefined) {
				appendEntryFn("cause", () =>
					toDiagnosticValueAtDepthFn(value.cause, depth + 1, seen, budget),
				);
			}
			if (value instanceof AggregateError) {
				const causes: unknown[] = [];
				for (const cause of value.errors) {
					if (causes.length >= 20) break;
					causes.push(cause);
				}
				appendEntryFn("errors", () =>
					toDiagnosticValueAtDepthFn(causes, depth + 1, seen, budget),
				);
			}
			for (const key of Object.keys(value).slice(0, maxDiagnosticEntries)) {
				if (
					key === "name" ||
					key === "message" ||
					key === "stack" ||
					key === "cause" ||
					key === "errors"
				) {
					continue;
				}
				let customValue: unknown;
				try {
					customValue = (value as unknown as Record<string, unknown>)[key];
				} catch (cause) {
					if (!appendEntryFn(key, () => toUnreadableDiagnosticValueFn(cause, budget)))
						break;
					continue;
				}
				if (
					!appendEntryFn(key, () =>
						toDiagnosticValueAtDepthFn(customValue, 0, seen, budget),
					)
				) {
					break;
				}
			}
			return error;
		}
		if (Array.isArray(value)) {
			const result: DiagnosticValue[] = [];
			budget.remaining -= 2;
			for (const entry of value.slice(0, maxDiagnosticEntries)) {
				const entryOverhead = result.length === 0 ? 0 : 1;
				if (budget.remaining < entryOverhead + 2) break;
				budget.remaining -= entryOverhead;
				result.push(toDiagnosticValueAtDepthFn(entry, depth + 1, seen, budget));
			}
			return result;
		}

		const result = createDiagnosticRecordFn();
		let entryCount = 0;
		budget.remaining -= 2;
		for (const key of Object.keys(value).slice(0, maxDiagnosticEntries)) {
			const boundedKey = key.slice(0, 100);
			const entryOverhead =
				(entryCount === 0 ? 0 : 1) + JSON.stringify(boundedKey).length + 1;
			if (budget.remaining < entryOverhead + 2) break;
			let propertyValue: unknown;
			try {
				propertyValue = (value as Record<string, unknown>)[key];
			} catch (cause) {
				budget.remaining -= entryOverhead;
				result[boundedKey] = toUnreadableDiagnosticValueFn(cause, budget);
				entryCount += 1;
				continue;
			}
			budget.remaining -= entryOverhead;
			result[boundedKey] = toDiagnosticValueAtDepthFn(propertyValue, depth + 1, seen, budget);
			entryCount += 1;
		}
		return result;
	} catch (cause) {
		budget.remaining = startingBudget;
		return toUnreadableDiagnosticValueFn(cause, budget);
	}
};

/** Converts unknown failures and Effect/Pixi objects into a bounded JSON-safe diagnostic value. */
export const toDiagnosticValueFn = (value: unknown): DiagnosticValue =>
	toDiagnosticValueAtDepthFn(value, 0, new WeakSet<object>(), {
		remaining: maxDiagnosticSerializedLength,
	});
