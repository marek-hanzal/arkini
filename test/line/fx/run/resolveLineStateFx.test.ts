import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { resolveLineEnableFx } from "~/engine/line/fx/run/resolveLineEnableFx";
import { resolveLineRuntimeFx } from "~/engine/line/fx/run/resolveLineRuntimeFx";
import { resolveLineShowFx } from "~/engine/line/fx/run/resolveLineShowFx";
import type { RulesResultSchema } from "~/engine/line/schema/rule/RulesResultSchema";

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
] satisfies RulesResultSchema.Type;

describe("line run rule projections", () => {
	it("lets an active show rule reveal a hidden line", () => {
		expect(
			Effect.runSync(
				resolveLineShowFx({
					line: {
						show: false,
					},
					rules: activeRules,
				}),
			),
		).toBe(true);
	});

	it("lets an active hide rule veto every show source", () => {
		expect(
			Effect.runSync(
				resolveLineShowFx({
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
			),
		).toBe(false);
	});

	it("uses every enable rule as a gate and disable as a veto", () => {
		expect(
			Effect.runSync(
				resolveLineEnableFx({
					line: {
						enable: false,
					},
					rules: activeRules,
				}),
			),
		).toBe(true);
		expect(
			Effect.runSync(
				resolveLineEnableFx({
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
			),
		).toBe(false);
	});

	it("multiplies every active runtime rule and rounds up", () => {
		expect(
			Effect.runSync(
				resolveLineRuntimeFx({
					line: {
						runtimeMs: 101,
					},
					rules: activeRules,
				}),
			),
		).toBe(76);
	});
});
