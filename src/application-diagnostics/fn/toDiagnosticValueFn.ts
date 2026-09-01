import type { DiagnosticValue } from "~electron/contract/diagnostics/DiagnosticRecord";

const maxDiagnosticScalarLength = 8_192;
const maxDiagnosticSerializedLength = 48 * 1_024;
const maxDiagnosticDepth = 6;
const maxDiagnosticEntries = 100;

type DiagnosticBudget = {
	remaining: number;
	truncated: boolean;
};

const toDiagnosticStringFn = (value: string, budget: DiagnosticBudget): string => {
	const scalar = value.slice(0, maxDiagnosticScalarLength);
	if (scalar.length !== value.length) budget.truncated = true;
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
	budget.truncated = true;
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
	const startingTruncated = budget.truncated;
	try {
		if (typeof value === "string") return toDiagnosticStringFn(value, budget);
		if (value === null || typeof value === "boolean") {
			const serializedLength = JSON.stringify(value).length;
			if (serializedLength > budget.remaining) {
				budget.truncated = true;
				return toDiagnosticStringFn("", budget);
			}
			budget.remaining -= serializedLength;
			return value;
		}
		if (typeof value === "number") {
			if (!Number.isFinite(value)) return toDiagnosticStringFn(String(value), budget);
			const serializedLength = JSON.stringify(value).length;
			if (serializedLength > budget.remaining) {
				budget.truncated = true;
				return toDiagnosticStringFn("", budget);
			}
			budget.remaining -= serializedLength;
			return value;
		}
		if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function") {
			return toDiagnosticStringFn(String(value), budget);
		}
		if (typeof value !== "object") return toDiagnosticStringFn(String(value), budget);
		if (seen.has(value)) return toDiagnosticStringFn("[Circular]", budget);
		if (depth >= maxDiagnosticDepth) {
			budget.truncated = true;
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
				if (budget.remaining < entryOverhead + 2) {
					budget.truncated = true;
					return false;
				}
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
			const keys = Object.keys(value);
			if (keys.length > maxDiagnosticEntries) budget.truncated = true;
			for (const key of keys.slice(0, maxDiagnosticEntries)) {
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
			seen.delete(value);
			return error;
		}
		if (Array.isArray(value)) {
			const result: DiagnosticValue[] = [];
			budget.remaining -= 2;
			if (value.length > maxDiagnosticEntries) budget.truncated = true;
			for (const entry of value.slice(0, maxDiagnosticEntries)) {
				const entryOverhead = result.length === 0 ? 0 : 1;
				if (budget.remaining < entryOverhead + 2) {
					budget.truncated = true;
					break;
				}
				budget.remaining -= entryOverhead;
				result.push(toDiagnosticValueAtDepthFn(entry, depth + 1, seen, budget));
			}
			seen.delete(value);
			return result;
		}

		const result = createDiagnosticRecordFn();
		let entryCount = 0;
		budget.remaining -= 2;
		const keys = Object.keys(value);
		if (keys.length > maxDiagnosticEntries) budget.truncated = true;
		for (const key of keys.slice(0, maxDiagnosticEntries)) {
			const boundedKey = key.slice(0, 100);
			const entryOverhead =
				(entryCount === 0 ? 0 : 1) + JSON.stringify(boundedKey).length + 1;
			if (budget.remaining < entryOverhead + 2) {
				budget.truncated = true;
				break;
			}
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
		seen.delete(value);
		return result;
	} catch (cause) {
		if (value !== null && typeof value === "object") seen.delete(value);
		budget.remaining = startingBudget;
		budget.truncated = startingTruncated;
		return toUnreadableDiagnosticValueFn(cause, budget);
	}
};

export interface DiagnosticValueResult {
	readonly value: DiagnosticValue;
	readonly truncated: boolean;
}

/** Converts unknown failures and Effect/Pixi objects into bounded diagnostic data. */
export const toDiagnosticValueResultFn = (
	value: unknown,
	serializedLengthLimit = maxDiagnosticSerializedLength,
): DiagnosticValueResult => {
	const budget: DiagnosticBudget = {
		remaining:
			Number.isFinite(serializedLengthLimit) && serializedLengthLimit >= 2
				? Math.min(maxDiagnosticSerializedLength, Math.floor(serializedLengthLimit))
				: maxDiagnosticSerializedLength,
		truncated: false,
	};
	return {
		value: toDiagnosticValueAtDepthFn(value, 0, new WeakSet<object>(), budget),
		truncated: budget.truncated,
	};
};

export const toDiagnosticValueFn = (
	value: unknown,
	serializedLengthLimit = maxDiagnosticSerializedLength,
): DiagnosticValue => toDiagnosticValueResultFn(value, serializedLengthLimit).value;
