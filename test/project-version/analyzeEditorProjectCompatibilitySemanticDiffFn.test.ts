import { describe, expect, it } from "vitest";

import { analyzeEditorProjectCompatibilityFn } from "~/project-version/fn/analyzeEditorProjectCompatibilityFn";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { editorTestConfig } from "~test/editor/support/editorTestPayload";
import {
	createLine,
	createOutput,
	createProducerItem,
} from "~test/game-config/validation/support/gameValidationTestSource";

const analyze = (previous: GameConfigSchema.Type, next: GameConfigSchema.Type) =>
	analyzeEditorProjectCompatibilityFn(previous, next);

const withProducer = () => {
	const producer = createProducerItem({
		id: "producer",
		lines: [
			createLine({
				id: "line:first",
			}),
			createLine({
				id: "line:second",
			}),
		],
	});
	return GameConfigSchema.parse({
		...editorTestConfig,
		items: {
			...editorTestConfig.items,
			producer,
		},
	});
};

describe("analyzeEditorProjectCompatibilityFn semantic diff", () => {
	it("normalizes equivalent defaults and ignores record order", () => {
		const previous = withProducer();
		const next = GameConfigSchema.parse({
			...previous,
			meta: {
				...previous.meta,
				toolbarSize: 0,
			},
			start: {
				...previous.start,
				board: previous.start.board.map((item) => ({
					...item,
					quantity: 1,
				})),
			},
			items: {
				producer: previous.items.producer,
				water: previous.items.water,
			},
		});

		expect(analyze(previous, next)).toEqual({
			result: "noop",
			context: [],
		});
	});

	it("correlates lines by stable ID while treating order and output changes as major", () => {
		const previous = withProducer();
		const producer = previous.items.producer;
		if (producer?.type !== "producer") throw new Error("Missing producer fixture.");
		const next = GameConfigSchema.parse({
			...previous,
			items: {
				...previous.items,
				producer: {
					...producer,
					lines: [
						producer.lines[1],
						{
							...producer.lines[0],
							output: createOutput([
								{
									itemId: "water",
								},
							]),
						},
					],
				},
			},
		});

		const compatibility = analyze(previous, next);

		expect(compatibility.result).toBe("major");
		expect(compatibility.context.map(({ path }) => path)).toEqual([
			[
				"items",
				"producer",
				"lines",
				"line:first",
				"output",
			],
			[
				"items",
				"producer",
				"lines",
			],
		]);
	});

	it("reports added and removed authored identities as atomic major subtrees", () => {
		const producer = createProducerItem({
			id: "producer",
		});
		const withAddedItem = GameConfigSchema.parse({
			...editorTestConfig,
			items: {
				...editorTestConfig.items,
				producer,
			},
		});

		expect(analyze(editorTestConfig, withAddedItem)).toMatchObject({
			result: "major",
			context: [
				{
					operation: "add",
					path: [
						"items",
						"producer",
					],
					result: "major",
				},
			],
		});
		expect(analyze(withAddedItem, editorTestConfig)).toMatchObject({
			result: "major",
			context: expect.arrayContaining([
				expect.objectContaining({
					operation: "remove",
					path: [
						"items",
						"producer",
					],
				}),
			]),
		});
	});

	it("correlates renamed items by immutable UID instead of reporting two subtrees", () => {
		const previous = withProducer();
		const producer = previous.items.producer;
		if (producer?.type !== "producer") throw new Error("Missing producer fixture.");
		const next = GameConfigSchema.parse({
			...previous,
			items: {
				water: previous.items.water,
				renamed: {
					...producer,
					id: "renamed",
				},
			},
		});

		expect(analyze(previous, next)).toMatchObject({
			result: "major",
			context: [
				{
					before: "producer",
					after: "renamed",
					operation: "change",
					path: [
						"items",
						"renamed",
						"id",
					],
					result: "major",
				},
			],
		});
	});
});
