import { describe, expect, it } from "vitest";
import { copyItemSectionFn } from "~/item-authoring/fn/copyItemSectionFn";
import { FormSchema, type FormValues } from "~/item-authoring/schema/FormSchema";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";

const source = ItemSchema.parse({
	uid: "source",
	id: "source",
	title: "Source",
	artwork: {
		scale: 0.8,
		default: [
			"base",
			"overlay",
		],
	},
	maxQueueSize: 3,
	lines: [
		{
			id: "source-line",
			title: "Line",
			description: "Line",
			default: true,
			show: true,
			enable: true,
			runtimeMs: 1,
			input: [
				{
					type: "units",
					units: {
						cost: 1,
						from: "self",
					},
					query: {
						distance: "self",
						selector: {
							type: "item",
							itemId: "source",
						},
					},
				},
			],
			rules: [],
		},
	],
	clock: {
		enable: true,
		durationMs: 300000,
		rules: [],
	},
	units: {
		amount: 4,
	},
	merge: [
		{
			action: "use",
			effect: "keep",
			target: {
				type: "item",
				itemId: "other",
			},
		},
	],
});
const destination: FormValues = {
	...source,
	uid: "destination",
	id: "destination",
	title: "Destination",
	draft: true,
	description: "Keep this unsaved description",
	artwork: {
		scale: 1,
		default: [
			"other",
			"",
		],
	},
	lines: [
		{
			...source.lines[0],
			id: "old-line",
		},
		{
			...source.lines[0],
			id: "extra-line",
		},
	],
};

describe("section copy ownership", () => {
	it("replaces every production line without mutating the source or other draft sections", () => {
		const before = structuredClone(source);
		const result = copyItemSectionFn(destination, source, "production");
		expect(result.lines).toEqual(source.lines);
		expect(result.lines).toHaveLength(1);
		expect(result.lines).not.toBe(source.lines);
		expect(result.lines?.[0].input).not.toBe(source.lines[0].input);
		expect(result.artwork).toBe(destination.artwork);
		expect(result.title).toBe(destination.title);
		expect(result.description).toBe(destination.description);
		expect(result.id).toBe(destination.id);
		expect(result.uid).toBe(destination.uid);
		expect(result.draft).toBe(true);
		expect(FormSchema.parse(result).lines[0].input[0]).toMatchObject({
			query: {
				distance: "self",
				selector: {
					itemId: "destination",
				},
			},
		});
		expect(source).toEqual(before);
	});
	it("preserves identity and Clock constraints when replacing basic item fields", () => {
		const result = copyItemSectionFn(
			destination,
			{
				...source,
				title: "New title",
				description: undefined,
				clock: undefined,
			},
			"identity",
		);
		expect(result).toMatchObject({
			uid: "destination",
			id: "destination",
			title: "New title",
			draft: true,
			description: "",
		});
		expect(result.lines).toBe(destination.lines);
	});
	it("replaces artwork including clearing an absent overlay", () => {
		const result = copyItemSectionFn(
			destination,
			{
				...source,
				artwork: {
					scale: 0.5,
					default: [
						"new",
					],
				},
			},
			"artwork",
		);
		expect(result.artwork).toEqual({
			scale: 0.5,
			default: [
				"new",
				"",
			],
		});
		expect(result.clock).toBe(destination.clock);
	});
	it.each([
		"merges",
		"units",
		"clock",
		"action",
	] as const)("clears absent %s instead of retaining destination data", (section) => {
		const action = {
			type: "space" as const,
			space: 0,
			input: [],
			rules: [],
		};
		const current =
			section === "action"
				? {
						...destination,
						lines: [],
						clock: undefined,
						action,
					}
				: destination;
		const result = copyItemSectionFn(
			current,
			{
				...source,
				merge: undefined,
				units: undefined,
				clock: undefined,
				action: undefined,
			},
			section,
		);
		expect(result[section === "merges" ? "merge" : section]).toBeUndefined();
		expect(result.artwork).toBe(current.artwork);
	});
	it("applies capability exclusions only when the copied capability is present", () => {
		const action = {
			type: "space" as const,
			space: 0,
			input: [],
			rules: [],
		};
		const withAction = copyItemSectionFn(
			destination,
			{
				...source,
				lines: [],
				clock: undefined,
				action,
			},
			"action",
		);
		expect(withAction.lines).toEqual([]);
		expect(withAction.clock).toBeUndefined();
		expect(withAction.action).toEqual(action);
		expect(copyItemSectionFn(withAction, source, "production").action).toBeUndefined();
		expect(
			copyItemSectionFn(
				withAction,
				{
					...source,
					lines: [],
				},
				"production",
			).action,
		).toBe(withAction.action);
		const withClock = copyItemSectionFn(
			{
				...withAction,
			},
			source,
			"clock",
		);
		expect(withClock).toMatchObject({
			clock: source.clock,
		});
		expect(withClock.action).toBeUndefined();
		expect(withClock.clock).not.toBe(source.clock);
	});
	it("does not copy onto the same stable identity after a draft rename", () => {
		expect(
			copyItemSectionFn(
				{
					...destination,
					uid: source.uid,
				},
				source,
				"production",
			).lines,
		).toBe(destination.lines);
	});
});
