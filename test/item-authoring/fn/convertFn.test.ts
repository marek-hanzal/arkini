import { describe, expect, it } from "vitest";

import { convertFn } from "~/item-authoring/fn/convertFn";
import { createDraftFn } from "~/item-authoring/fn/createDraftFn";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";

const createItem = (type: (typeof TypeSchema.options)[number]): ItemSchema.Type => ({
	...createDraftFn({
		resourceId: "asset:item",
		type,
		uid: "stable-item-uid",
	}),
	title: "Test item",
	description: "A valid item used by conversion tests.",
});

describe("convertFn", () => {
	it("produces a valid target for every supported conversion", () => {
		for (const sourceType of TypeSchema.options)
			for (const targetType of TypeSchema.options)
				expect(
					ItemSchema.safeParse(convertFn(createItem(sourceType), targetType)).success,
				).toBe(true);
	});
	it("preserves a Blueprint line and identity when converted to Common", () => {
		const blueprint = {
			...createItem("blueprint"),
			draft: true,
		};
		if (blueprint.type !== "blueprint") throw new Error("Expected Blueprint fixture.");
		expect(convertFn(blueprint, "common")).toMatchObject({
			type: "common",
			lines: [
				blueprint.line,
			],
			id: blueprint.id,
			uid: blueprint.uid,
			draft: true,
		});
	});
	it("retains every production line and queue capacity through Clock conversion", () => {
		const clock = createItem("clock");
		if (clock.type !== "clock") throw new Error("Expected Clock fixture.");
		const source = {
			...clock,
			maxQueueSize: 4,
			lines: [
				clock.lines[0],
				{
					...clock.lines[0],
					id: "line:second",
					default: false,
				},
			] as typeof clock.lines,
		};
		const common = convertFn(source, "common");
		if (common.type !== "common") throw new Error("Expected Common conversion.");
		expect(common).toMatchObject({
			type: "common",
			lines: source.lines,
			maxQueueSize: 4,
		});
		expect("intervalMs" in common).toBe(false);
		expect(
			convertFn(
				{
					...common,
					scope: "inventory",
					maxStackSize: 9,
				},
				"clock",
			),
		).toMatchObject({
			type: "clock",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 4,
			lines: source.lines,
		});
		const blueprint = convertFn(common, "blueprint");
		expect(blueprint).toMatchObject({
			type: "blueprint",
			line: source.lines[0],
		});
	});
	it("keeps passive Common conversions empty and supplies a line only for Clock", () => {
		const temporary = createItem("temporary");
		if (temporary.type !== "temporary") throw new Error("Expected Temporary fixture.");
		expect(convertFn(temporary, "common")).toMatchObject({
			type: "common",
			lines: [],
			maxQueueSize: 1,
		});
		const common = createItem("common");
		expect(common).toMatchObject({
			type: "common",
			lines: [],
		});
		const clock = convertFn(common, "clock");
		expect(clock.type).toBe("clock");
		if (clock.type !== "clock") throw new Error("Expected Clock conversion.");
		expect(clock.lines).toHaveLength(1);
		expect(clock.lines[0].default).toBe(true);
		expect(convertFn(temporary, "clock")).toMatchObject({
			durationMs: temporary.durationMs,
		});
	});
	it("enforces target invariants while retaining shared data", () => {
		const draft = createItem("common");
		if (draft.type !== "common") throw new Error("Expected Common fixture.");
		const common = {
			...draft,
			maxCount: 9,
			maxStackSize: 20,
			scope: "inventory" as const,
		};
		expect(convertFn(common, "inventory")).toMatchObject({
			maxCount: 1,
			maxStackSize: 1,
			scope: "board",
			title: common.title,
			type: "inventory",
		});
	});
});
