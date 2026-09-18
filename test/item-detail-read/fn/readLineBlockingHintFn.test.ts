import { expect, it } from "vitest";
import { readLineBlockingHintFn } from "~/item-detail-read/fn/readLineBlockingHintFn";
import { RuleSchema } from "~/production-line/schema/RuleSchema";

const ruleFn = (type: "enable" | "disable" | "show", hint?: string) =>
	RuleSchema.parse({
		type,
		hint,
		when: [
			{
				type: "exists",
				query: {
					scope: "any",
					selector: {
						type: "item",
						itemId: "tree",
					},
				},
			},
		],
	});

it("explains the first failed gate or active veto in authored order", () => {
	const line = {
		enable: true,
		rules: [
			ruleFn("show", "Visibility"),
			ruleFn("enable", "Needs a tree"),
			ruleFn("disable", "Blocked"),
			ruleFn("enable", "Already satisfied"),
		],
	};
	expect(
		readLineBlockingHintFn({
			line,
			rules: [
				{
					type: "show",
					active: false,
				},
				{
					type: "enable",
					active: false,
				},
				{
					type: "disable",
					active: true,
				},
				{
					type: "enable",
					active: true,
				},
			],
		}),
	).toBe("Needs a tree");
	expect(
		readLineBlockingHintFn({
			line,
			rules: [
				{
					type: "show",
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
					type: "enable",
					active: true,
				},
			],
		}),
	).toBeUndefined();
});

it("keeps the first blocker silent even when a later blocker has a hint", () => {
	expect(
		readLineBlockingHintFn({
			line: {
				enable: true,
				rules: [
					ruleFn("enable"),
					ruleFn("disable", "Later blocker"),
				],
			},
			rules: [
				{
					type: "enable",
					active: false,
				},
				{
					type: "disable",
					active: true,
				},
			],
		}),
	).toBeUndefined();
	expect(
		readLineBlockingHintFn({
			line: {
				enable: false,
				rules: [],
			},
			rules: [],
		}),
	).toBeUndefined();
});
