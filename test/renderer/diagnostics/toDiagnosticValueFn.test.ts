import { describe, expect, it } from "vitest";

import { toDiagnosticValueFn } from "~/renderer/diagnostics/fn/toDiagnosticValueFn";

describe("toDiagnosticValueFn", () => {
	it("bounds a circular object with one traversal-owned seen set", () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;

		const expected = {
			self: "[Circular]",
		};
		expect(toDiagnosticValueFn(circular)).toEqual(expected);
		expect(toDiagnosticValueFn(circular)).toEqual(expected);
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
