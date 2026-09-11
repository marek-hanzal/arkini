import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import {
	createLine,
	createOutput,
	createProducerItem,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { renameFx } from "~/item-authoring/fx/renameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

describe("renameFx", () => {
	it("rewrites exact references across start, selectors, inputs, and outputs", () => {
		const ignore = {
			type: "ignore",
		};
		const output = createOutput([
			{
				itemId: "water",
			},
		]);
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			items: {
				water: editorTestConfig.items.water,
				oil: {
					...createSimpleItem("oil"),
					asset: {
						scale: 1,
						default: [
							"oil",
						],
						neighbors: [
							{
								sourceId: "joined-oil",
								neighbors: {
									nw: ignore,
									n: {
										type: "item",
										itemId: "water",
									},
									ne: ignore,
									w: ignore,
									e: ignore,
									sw: ignore,
									s: ignore,
									se: ignore,
								},
							},
						],
					},
					merge: [
						{
							action: "use",
							effect: "keep",
							target: {
								type: "item",
								itemId: "water",
							},
						},
					],
					charges: {
						amount: 1,
						output,
					},
				},
				producer: createProducerItem({
					id: "producer",
					lines: [
						createLine({
							id: "water-line",
							input: [
								{
									capacity: 0,
									mode: "consume",
									type: "materials",
									selector: {
										type: "item",
										itemId: "water",
									},
									quantity: {
										min: 1,
										max: 1,
									},
								},
							],
							output,
						}),
					],
				}),
			},
		});

		const result = Effect.runSync(
			renameFx({
				config,
				itemId: "water",
				newItemId: "fresh-water",
			}),
		);

		expect(result.config.items["fresh-water"]).toMatchObject({
			id: "fresh-water",
			uid: "water",
		});
		expect(result.config.start.board[0]?.itemId).toBe("fresh-water");
		expect(JSON.stringify(result.config.items.oil)).not.toContain('"water"');
		expect(JSON.stringify(result.config.items.producer)).not.toContain('"water"');
		expect(result.updatedReferencePaths).toHaveLength(6);
		expect(result.config.items.oil.asset.neighbors?.[0]?.neighbors.n).toEqual({
			type: "item",
			itemId: "fresh-water",
		});
		expect(GameConfigSchema.parse(result.config)).toEqual(result.config);
	});
});
