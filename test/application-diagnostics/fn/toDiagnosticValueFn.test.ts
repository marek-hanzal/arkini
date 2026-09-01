import { describe, expect, it } from "vitest";

import { DiagnosticRecordSchema } from "~electron/contract/diagnostics/DiagnosticRecord";
import {
	toDiagnosticValueFn,
	toDiagnosticValueResultFn,
} from "~/application-diagnostics/fn/toDiagnosticValueFn";

describe("toDiagnosticValueFn", () => {
	it("honors a smaller record-owned serialization budget", () => {
		const result = toDiagnosticValueResultFn(
			{
				items: Array.from(
					{
						length: 100,
					},
					(_, index) => ({
						id: `runtime:item:${index}`,
						label: "x".repeat(100),
					}),
				),
			},
			256,
		);

		expect(JSON.stringify(result.value).length).toBeLessThanOrEqual(256);
		expect(result.truncated).toBe(true);
	});

	it("reports complete diagnostic values without a false truncation warning", () => {
		expect(
			toDiagnosticValueResultFn({
				source: "tick",
			}),
		).toEqual({
			value: {
				source: "tick",
			},
			truncated: false,
		});
	});

	it("bounds a circular object with one traversal-owned seen set", () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;

		const expected = {
			self: "[Circular]",
		};
		expect(toDiagnosticValueFn(circular)).toEqual(expected);
		expect(toDiagnosticValueFn(circular)).toEqual(expected);
	});

	it("preserves repeated immutable aliases outside the current ancestor path", () => {
		const location = {
			scope: "board",
			space: 0,
			position: {
				x: 2,
				y: 3,
			},
		};

		expect(
			toDiagnosticValueFn({
				event: {
					location,
				},
				state: {
					location,
				},
			}),
		).toEqual({
			event: {
				location,
			},
			state: {
				location,
			},
		});
	});

	it("contains reflection failures from an unknown diagnostic value", () => {
		const unreadable = new Proxy(
			{},
			{
				ownKeys: () => {
					throw new Error("reflection failed");
				},
			},
		);

		expect(toDiagnosticValueFn(unreadable)).toBe("[Unreadable: Error: reflection failed]");
	});

	it("preserves hostile object keys without changing the normalized record prototype", () => {
		const hostile = Object.create(null) as Record<string, unknown>;
		Object.defineProperty(hostile, "__proto__", {
			value: "owned",
			enumerable: true,
		});

		const normalized = toDiagnosticValueFn(hostile);

		if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) {
			throw new Error("Expected a normalized diagnostic record.");
		}
		expect(Object.getPrototypeOf(normalized)).toBeNull();
		expect(Object.hasOwn(normalized, "__proto__")).toBe(true);
		expect(JSON.stringify(normalized)).toBe('{"__proto__":"owned"}');
		expect(() =>
			DiagnosticRecordSchema.parse({
				level: "error",
				category: [
					"runtime",
				],
				event: "hostile-key",
				data: normalized,
			}),
		).not.toThrow();
	});

	it("keeps long scalars and aggregate trees inside the diagnostic transport contract", () => {
		const scalar = toDiagnosticValueFn(Symbol("x".repeat(9_000)));
		const tree = toDiagnosticValueFn(
			Array.from(
				{
					length: 100,
				},
				() => "\0".repeat(8_192),
			),
		);
		const record = {
			level: "error" as const,
			category: [
				"runtime",
			],
			event: "bounded-diagnostic",
			data: {
				scalar,
				tree,
			},
		};

		expect(typeof scalar).toBe("string");
		expect((scalar as string).length).toBeLessThanOrEqual(8_192);
		expect(JSON.stringify(record).length).toBeLessThan(65_536);
		expect(() => DiagnosticRecordSchema.parse(record)).not.toThrow();
	});

	it("preserves an Error cause as structured diagnostic context", () => {
		expect(
			toDiagnosticValueFn(
				new Error("outer failure", {
					cause: new Error("inner failure"),
				}),
			),
		).toMatchObject({
			name: "Error",
			message: "outer failure",
			cause: {
				name: "Error",
				message: "inner failure",
			},
		});
	});

	it("preserves bounded AggregateError members", () => {
		expect(
			toDiagnosticValueFn(
				new AggregateError(
					[
						new Error("first failure"),
						{
							code: "second-failure",
						},
					],
					"combined failure",
				),
			),
		).toMatchObject({
			name: "AggregateError",
			message: "combined failure",
			errors: [
				{
					name: "Error",
					message: "first failure",
				},
				{
					code: "second-failure",
				},
			],
		});
	});

	it("keeps custom Error fields as diagnostic roots inside deep wrappers", () => {
		const failure = Object.assign(new Error("domain failure"), {
			details: {
				first: {
					second: "preserved",
				},
			},
		});

		expect(
			toDiagnosticValueFn({
				first: {
					second: {
						third: {
							fourth: {
								failure,
							},
						},
					},
				},
			}),
		).toMatchObject({
			first: {
				second: {
					third: {
						fourth: {
							failure: {
								details: {
									first: {
										second: "preserved",
									},
								},
							},
						},
					},
				},
			},
		});
	});

	it("replaces objects at the depth limit with their constructor name", () => {
		expect(
			toDiagnosticValueFn({
				first: {
					second: {
						third: {
							fourth: {
								fifth: {
									sixth: {
										hidden: true,
									},
								},
							},
						},
					},
				},
			}),
		).toEqual({
			first: {
				second: {
					third: {
						fourth: {
							fifth: {
								sixth: "[Object]",
							},
						},
					},
				},
			},
		});
	});
});
