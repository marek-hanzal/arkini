import { describe, expect, it } from "vitest";

import { resolveLineEnableFn } from "~/production-line/fn/resolveLineEnableFn";
import { resolveLineShowFn } from "~/production-line/fn/resolveLineShowFn";
import type { lineRulesFx } from "~/production-line/fx/lineRulesFx";

const activeRules = [
	{
		type: "show",
		active: true,
	},
	{
		type: "hide",
		active: false,
	},
	{
		type: "enable",
		active: true,
	},
	{
		type: "disable",
		active: false,
	},
	{
		type: "runtime:multiplier",
		active: true,
		multiplier: 0.5,
	},
	{
		type: "runtime:multiplier",
		active: true,
		multiplier: 1.5,
	},
] satisfies lineRulesFx.Result;

describe("line run rule projections", () => {
	it("lets active show reveal a line and active hide veto every show source", () => {
		expect(
			resolveLineShowFn({
				line: {
					show: false,
				},
				rules: activeRules,
			}),
		).toBe(true);
		expect(
			resolveLineShowFn({
				line: {
					show: true,
				},
				rules: [
					...activeRules,
					{
						type: "hide",
						active: true,
					},
				],
			}),
		).toBe(false);
	});

	it("uses every enable rule as a gate and disable as a veto", () => {
		expect(
			resolveLineEnableFn({
				line: {
					enable: false,
				},
				rules: activeRules,
			}),
		).toBe(true);
		expect(
			resolveLineEnableFn({
				line: {
					enable: true,
				},
				rules: [
					...activeRules,
					{
						type: "disable",
						active: true,
					},
				],
			}),
		).toBe(false);
	});
});
