import { expect, it } from "vitest";
import { readLineBlockingHintsFn } from "~/item-detail-read/fn/readLineBlockingHintsFn";
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

it("explains only failed enable gates and active disable vetoes, preserving authored rule identity", () => {
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
		readLineBlockingHintsFn({
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
	).toEqual([
		"Needs a tree",
		"Blocked",
	]);
	expect(
		readLineBlockingHintsFn({
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
	).toEqual([]);
});

it("keeps silent blockers silent instead of borrowing a hint from a non-blocking rule", () => {
	expect(
		readLineBlockingHintsFn({
			line: {
				enable: true,
				rules: [
					ruleFn("enable"),
					ruleFn("disable", "Not the reason"),
				],
			},
			rules: [
				{
					type: "enable",
					active: false,
				},
				{
					type: "disable",
					active: false,
				},
			],
		}),
	).toEqual([]);
	expect(
		readLineBlockingHintsFn({
			line: {
				enable: false,
				rules: [],
			},
			rules: [],
		}),
	).toEqual([]);
});
