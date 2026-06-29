import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";
import { readBoardItemCreateEffectFailureReason } from "~/v0/game/placement/readBoardItemCreateEffectFailureReason";

describe("readBoardItemCreateEffectFailureReason", () => {
	it("classifies mixed granted-and-blocked cells as block-create instead of missing-grant", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:block-near-producer": {
					name: "Block near producer",
					operations: [
						{
							kind: "item.blockCreate",
							target: {
								items: {
									anyOf: [
										{
											ids: [
												"item:twig",
											],
										},
									],
								},
							},
						},
					],
					radius: 1,
					scope: "local",
				},
				"effect:grant-near-producer": {
					name: "Grant near producer",
					operations: [
						{
							grantId: "grant:twig",
							kind: "grant.add",
							target: {
								items: {
									anyOf: [
										{
											ids: [
												"item:twig",
											],
										},
									],
								},
							},
						},
					],
					radius: 1,
					scope: "local",
				},
			},
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 3,
				},
				title: "Test",
			},
			items: {
				...baseConfig.items,
				"item:producer": {
					...baseConfig.items["item:producer"],
					passiveEffectIds: [
						"effect:grant-near-producer",
						"effect:block-near-producer",
					],
				},
				"item:twig": {
					...baseConfig.items["item:twig"],
					grantSelector: {
						allOf: [
							{
								ids: [
									"grant:twig",
								],
							},
						],
					},
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		expect(
			readBoardItemCreateEffectFailureReason({
				candidateCells: [
					{
						x: 1,
						y: 0,
					},
					{
						x: 2,
						y: 0,
					},
				],
				config,
				itemId: "item:twig",
				nowMs: 100,
				save,
			}),
		).toBe("effect:block-create");
	});

	it("classifies effect placement as missing-grant only when every candidate cell misses grants", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:unused-grant": {
					name: "Unused grant",
					operations: [
						{
							grantId: "grant:twig",
							kind: "grant.add",
							target: {
								items: {
									anyOf: [
										{
											ids: [
												"item:twig",
											],
										},
									],
								},
							},
						},
					],
					scope: "global",
				},
			},
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					grantSelector: {
						allOf: [
							{
								ids: [
									"grant:twig",
								],
							},
						],
					},
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		expect(
			readBoardItemCreateEffectFailureReason({
				candidateCells: [
					{
						x: 1,
						y: 0,
					},
				],
				config,
				itemId: "item:twig",
				nowMs: 100,
				save,
			}),
		).toBe("effect:missing-grant");
	});
});
