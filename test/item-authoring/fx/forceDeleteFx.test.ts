import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { forceDeleteFx } from "~/item-authoring/fx/forceDeleteFx";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import {
	createLine,
	createOutput,
	createProducerItem,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";

const waterOutput = createOutput([
	{
		itemId: "water",
	},
]);

describe("forceDeleteFx", () => {
	it("clears Clock timer references and expiry output, retaining owners after their final line is removed", () => {
		const clock = {
			...createProducerItem({
				id: "clock",
			}),

			scope: "board",
			maxStackSize: 1,
			clock: {
				intervalMs: 1000,
				rules: [
					{
						type: "enable",
						when: [
							{
								type: "exists",
								query: {
									scope: "any",
									selector: {
										type: "item",
										itemId: "water",
									},
								},
							},
						],
					},
				],
				onExpire: waterOutput,
			},
		};
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			items: {
				...editorTestConfig.items,
				clock,
				"clock-with-line": {
					...clock,
					id: "clock-with-line",
					uid: "clock-with-line",
					lines: [
						createLine({
							output: waterOutput,
						}),
					],
				},
			},
		});
		const result = Effect.runSync(
			forceDeleteFx({
				config,
				itemId: "water",
			}),
		);
		expect(result.config.items.clock).toMatchObject({
			clock: expect.objectContaining({
				rules: [],
			}),
			lines: clock.lines,
		});
		expect(result.config.items.clock).toHaveProperty("clock.onExpire", undefined);
		expect(result.config.items["clock-with-line"]).toMatchObject({
			lines: [],
			clock: {
				intervalMs: 1000,
			},
		});
		expect(result.impact.removedExpiryOutputOwnerIds).toContain("clock");
	});

	it("removes every directly referencing structure and keeps unrelated authoring intact", () => {
		const oil = createSimpleItem("oil");
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			start: {
				...editorTestConfig.start,
				inventory: [
					{
						itemId: "water",
						position: {
							x: 0,
							y: 0,
						},
						quantity: 2,
					},
				],
			},
			items: {
				water: editorTestConfig.items.water,
				oil: {
					...oil,
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
					units: {
						amount: 1,
						output: waterOutput,
					},
				},
				producer: createProducerItem({
					id: "producer",
					lines: [
						createLine({
							id: "water-line",
							output: waterOutput,
						}),
						createLine({
							id: "oil-line",
							output: createOutput([
								{
									itemId: "oil",
								},
							]),
						}),
					],
				}),
			},
		});

		const result = Effect.runSync(
			forceDeleteFx({
				config,
				itemId: "water",
			}),
		);

		expect(GameConfigSchema.parse(result.config)).toEqual(result.config);
		expect(result.config.items.water).toBeUndefined();
		expect(result.config.start.board).toEqual([]);
		expect(result.config.start.inventory).toEqual([]);
		expect(result.config.items.oil).toMatchObject({
			units: {
				amount: 1,
			},
		});
		expect(result.config.items.oil?.merge).toBeUndefined();
		expect(result.config.items.producer).toMatchObject({
			lines: [
				{
					id: "oil-line",
				},
			],
		});
		expect(result.impact).toEqual({
			removedActionInputs: [],
			removedActionRules: [],
			removedUnitOutputOwnerIds: [
				"oil",
			],
			removedExpiryOutputOwnerIds: [],
			removedLines: [
				{
					ownerItemId: "producer",
					lineId: "water-line",
					title: "water-line",
				},
			],
			removedMergeRules: [
				{
					ownerItemId: "oil",
					ruleNumber: 1,
				},
			],
			removedStartEntries: {
				board: 1,
				inventory: 1,
				toolbar: 0,
			},
		});
	});

	it("removes only Space action entries that reference the deleted item", () => {
		const {
			lines: _lines,
			maxQueueSize: _queueSize,
			...portalBase
		} = createSimpleItem("portal");
		const portal = {
			...portalBase,

			action: {
				type: "space" as const,
				space: 1,
				input: [
					{
						type: "units" as const,
						query: {
							scope: "board" as const,
							distance: "close" as const,
							selector: {
								type: "item" as const,
								itemId: "water",
							},
						},
						units: {
							from: "target" as const,
							cost: 1,
						},
					},
				],
				rules: [
					{
						type: "enable" as const,
						when: [
							{
								type: "exists" as const,
								query: {
									scope: "universe" as const,
									selector: {
										type: "item" as const,
										itemId: "water",
									},
								},
							},
						],
					},
				],
			},
		};
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			start: {
				...editorTestConfig.start,
				board: [],
			},
			items: {
				water: editorTestConfig.items.water,
				portal,
			},
		});
		const result = Effect.runSync(
			forceDeleteFx({
				config,
				itemId: "water",
			}),
		);

		expect(result.config.items.portal).toMatchObject({
			action: {
				type: "space",
				space: 1,
				input: [],
				rules: [],
			},
		});
		expect(result.impact.removedActionInputs).toEqual([
			{
				ownerItemId: "portal",
				inputNumber: 1,
			},
		]);
		expect(result.impact.removedActionRules).toEqual([
			{
				ownerItemId: "portal",
				ruleNumber: 1,
			},
		]);
	});

	it("retains a passive Common owner after its last dependent line is removed", () => {
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			start: {
				...editorTestConfig.start,
				board: [
					{
						itemId: "producer",
						space: 0,
						x: 0,
						y: 0,
					},
				],
			},
			items: {
				...editorTestConfig.items,
				producer: createProducerItem({
					id: "producer",
					output: waterOutput,
				}),
			},
		});

		const result = Effect.runSync(
			forceDeleteFx({
				config,
				itemId: "water",
			}),
		);

		expect(result.config.items.producer).toMatchObject({
			lines: [],
		});
		expect(result.config.start.board).toEqual(config.start.board);
		expect(GameConfigSchema.parse(result.config)).toEqual(result.config);
	});
});
