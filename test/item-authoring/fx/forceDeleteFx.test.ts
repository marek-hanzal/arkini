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
		itemUid: "water",
	},
]);

describe("forceDeleteFx", () => {
	it("removes referenced template cells while retaining the template and unrelated placements", () => {
		const template = {
			uid: "template",
			title: "Template",
			width: 8,
			height: 3,
			board: [
				{
					x: 7,
					y: 2,
					itemUid: "water",
				},
			],
		};
		const result = Effect.runSync(
			forceDeleteFx({
				config: {
					...editorTestConfig,
					templates: [
						template,
					],
				},
				itemUid: "water",
			}),
		);
		expect(result.config.templates).toEqual([
			{
				...template,
				board: [],
			},
		]);
		expect(result.impact.removedTemplateEntries).toEqual([
			{
				templateUid: "template",
				title: "Template",
				count: 1,
			},
		]);
	});
	it("clears Clock timer references and expiry outcome, retaining owners after their final line is removed", () => {
		const clock = {
			...createProducerItem({
				id: "clock",
			}),
			clock: {
				intervalMs: 1000,
				rules: [
					{
						type: "enable",
						when: [
							{
								type: "exists",
								query: {
									distance: "far",
									selector: {
										type: "item",
										itemUid: "water",
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
					uid: "clock-with-line",
					lines: [
						createLine({
							outcome: waterOutput,
						}),
					],
				},
			},
		});
		const result = Effect.runSync(
			forceDeleteFx({
				config,
				itemUid: "water",
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
		expect(result.impact.removedExpiryOutcomeOwnerIds).toContain("clock");
	});

	it("removes every directly referencing structure and keeps unrelated authoring intact", () => {
		const oil = createSimpleItem("oil");
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			start: {
				...editorTestConfig.start,
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
								itemUid: "water",
							},
						},
					],
					units: {
						amount: 1,
						outcome: waterOutput,
					},
				},
				producer: createProducerItem({
					id: "producer",
					lines: [
						createLine({
							uid: "water-line",
							outcome: waterOutput,
						}),
						createLine({
							uid: "oil-line",
							outcome: createOutput([
								{
									itemUid: "oil",
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
				itemUid: "water",
			}),
		);

		expect(GameConfigSchema.parse(result.config)).toEqual(result.config);
		expect(result.config.items.water).toBeUndefined();
		expect(result.config.templates![0]!.board).toEqual([]);
		expect(result.config.items.oil).toMatchObject({
			units: {
				amount: 1,
			},
		});
		expect(result.config.items.oil?.merge).toBeUndefined();
		expect(result.config.items.producer).toMatchObject({
			lines: [
				{
					uid: "oil-line",
				},
			],
		});
		expect(result.impact).toEqual({
			removedTemplateEntries: [
				{
					templateUid: "initial",
					title: "Initial",
					count: 1,
				},
			],
			removedClockRules: [],
			removedUnitOutcomeOwnerIds: [
				"oil",
			],
			removedExpiryOutcomeOwnerIds: [],
			removedLines: [
				{
					ownerItemUid: "producer",
					lineUid: "water-line",
					title: "water-line",
				},
			],
			removedMergeRules: [
				{
					ownerItemUid: "oil",
					ruleNumber: 1,
				},
			],
		});
	});

	it("retains a passive Common owner after its last dependent line is removed", () => {
		const config = GameConfigSchema.parse({
			...editorTestConfig,
			templates: [
				{
					uid: "initial",
					title: "Initial",
					width: 2,
					height: 2,
					board: [
						{
							itemUid: "producer",
							x: 0,
							y: 0,
						},
					],
				},
			],
			items: {
				...editorTestConfig.items,
				producer: createProducerItem({
					id: "producer",
					outcome: waterOutput,
				}),
			},
		});

		const result = Effect.runSync(
			forceDeleteFx({
				config,
				itemUid: "water",
			}),
		);

		expect(result.config.items.producer).toMatchObject({
			lines: [],
		});
		expect(result.config.templates![0]!.board).toEqual(config.templates![0]!.board);
		expect(GameConfigSchema.parse(result.config)).toEqual(result.config);
	});
});
