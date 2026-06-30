import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineCraftTableTestConfig } from "~/v0/game/engine/test/createEngineCraftTableTestConfig";
import { GameSaveConfigSchema } from "~/v0/game/engine/model/GameSaveSchema";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runGameTickFx } from "~/v0/game/engine/runGameTickFx";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { withRandomService } from "~/v0/random/logic/withRandomService";
import {
	findBoardItem,
	readOnlyRecordValue,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/v0/game/engine/applyGameActionFx.testSupport";

const runTick = (props: runGameTickFx.Props) =>
	Effect.runSync(runGameTickFx(props).pipe(withRandomService(TestRandomService)));

const readOwnedTwigGrantConfig = (
	baseConfig: ReturnType<typeof createEngineTestConfig>,
	productIds: readonly string[],
) => {
	const grantId = "grant:test:owned-twig";
	const effectId = "effect:test:owned-twig-grant";
	return {
		effects: {
			...baseConfig.effects,
			[effectId]: {
				name: "Owned Twig Grant",
				operations: [
					{
						grantId,
						kind: "grant.add",
						target: {
							productLines: {
								anyOf: productIds.map((productId) => ({
									ids: [
										productId,
									],
								})),
							},
						},
					},
				],
				scope: "global",
				sourceScope: "both",
			},
		},
		items: {
			...baseConfig.items,
			"item:twig": {
				...baseConfig.items["item:twig"],
				passiveEffectIds: [
					...(baseConfig.items["item:twig"].passiveEffectIds ?? []),
					effectId,
				],
			},
		},
		products: {
			...baseConfig.products,
			...Object.fromEntries(
				productIds.map((productId) => [
					productId,
					{
						...baseConfig.products[productId],
						grantSelector: {
							allOf: [
								{
									ids: [
										grantId,
									],
								},
							],
						},
					},
				]),
			),
		},
	} satisfies Partial<ReturnType<typeof createEngineTestConfig>>;
};

const readLocalTwigGrantConfig = (
	baseConfig: ReturnType<typeof createEngineTestConfig>,
	props: {
		productIds: readonly string[];
		radius: number;
	},
) => {
	const grantId = "grant:test:near-twig";
	const effectId = `effect:test:near-twig-grant:${props.radius}:${props.productIds.join("+")}`;
	return {
		effects: {
			...baseConfig.effects,
			[effectId]: {
				name: "Near Twig Grant",
				operations: [
					{
						grantId,
						kind: "grant.add",
						target: {
							productLines: {
								anyOf: props.productIds.map((productId) => ({
									ids: [
										productId,
									],
								})),
							},
						},
					},
				],
				radius: props.radius,
				scope: "local",
			},
		},
		items: {
			...baseConfig.items,
			"item:twig": {
				...baseConfig.items["item:twig"],
				passiveEffectIds: [
					...(baseConfig.items["item:twig"].passiveEffectIds ?? []),
					effectId,
				],
			},
		},
		products: {
			...baseConfig.products,
			...Object.fromEntries(
				props.productIds.map((productId) => [
					productId,
					{
						...baseConfig.products[productId],
						grantSelector: {
							allOf: [
								{
									ids: [
										grantId,
									],
								},
							],
						},
					},
				]),
			),
		},
	} satisfies Partial<ReturnType<typeof createEngineTestConfig>>;
};

describe("applyGameActionFx Producer", () => {
	it("starts a no-input producer product as an Effect action", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1500,
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startAtMs: 500,
		});
		expect(result.events).toEqual([
			{
				atMs: 500,
				readyAtMs: 1500,
				jobId: job.id,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				startAtMs: 500,
				type: "product.started",
			},
		]);
		expect(result.nextWakeAtMs).toBe(1500);
	});

	it("completes zero-duration producer products in the same action", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					durationMs: 0,
					output: [
						{
							itemId: "item:twig",
							quantity: 1,
							type: "guaranteed",
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result.save.producerJobs).toEqual({});
		expect(result.nextWakeAtMs).toBeNull();
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
		expect(result.events).toEqual([
			expect.objectContaining({
				atMs: 500,
				readyAtMs: 500,
				productId: "product:test",
				type: "product.started",
			}),
			expect.objectContaining({
				atMs: 500,
				productId: "product:test",
				type: "product.completed",
			}),
			expect.objectContaining({
				itemId: "item:twig",
				type: "item.created",
			}),
		]);
	});

	it("rejects blueprint producer output when the crafted target is already at maxCount", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 2,
				},
			},
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					maxCount: 1,
				},
				"item:blueprint-plank": {
					assetId: "asset:test",
					description: "Plank blueprint",
					maxStackSize: 1,
					storage: "both",
					name: "Plank Blueprint",
					tags: [
						"blueprint",
					],
					tier: 0,
				},
			},
			craftRecipes: {
				...baseConfig.craftRecipes,
				"item:blueprint-plank": {
					durationMs: 0,
					inputs: [],
					resultItemId: "item:plank",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					output: [
						{
							itemId: "item:blueprint-plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:plank",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "board:max-count",
			},
		});
	});

	it("does not block maxCount preflight for base output with zero effective drop chance", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:no-base-drop": {
					name: "No base drop",
					operations: [
						{
							delta: -1,
							kind: "loot.dropChance.add",
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
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
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					maxCount: 1,
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					output: [
						{
							itemId: "item:plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:plank",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:no-base-drop"] = {
			endAtMs: 10_000,
			effectId: "effect:no-base-drop",
			id: "effect-instance:no-base-drop",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(Object.values(result.save.producerJobs)).toHaveLength(1);
	});

	it("blocks maxCount preflight for guaranteed appended effect output", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:append-plank": {
					name: "Append plank",
					operations: [
						{
							kind: "loot.appendOutput",
							output: [
								{
									itemId: "item:plank",
									quantity: 1,
									type: "guaranteed",
								},
							],
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
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
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					maxCount: 1,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:plank",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:append-plank"] = {
			endAtMs: 10_000,
			effectId: "effect:append-plank",
			id: "effect-instance:append-plank",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};

		const result = runActionEither({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "board:max-count",
			},
		});
	});

	it("expires zero-duration activated effects in the same action", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:instant-window": {
					name: "Instant window",
					operations: [
						{
							kind: "line.reveal",
							target: {
								productLines: {
									mode: "all",
								},
							},
						},
					],
					scope: "global",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					activatesEffectId: "effect:instant-window",
					durationMs: 0,
					output: undefined,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result.save.producerJobs).toEqual({});
		expect(result.save.activeEffects).toEqual({});
		expect(result.events.map((event) => event.type)).toEqual([
			"product.started",
			"effect.activated",
			"product.completed",
			"effect.expired",
		]);
	});

	it("rejects producer start while the same target has a running craft job", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			craftRecipes: {
				...baseConfig.craftRecipes,
				"item:producer": {
					durationMs: 1000,
					inputs: [],
					resultItemId: "item:plank",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const crafting = runAction({
			action: {
				recipeId: "item:producer",
				targetItemInstanceId: "item-instance:1",
				type: "craft.start",
			},
			config,
			nowMs: 100,
			save,
		});

		const result = runActionEither({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 200,
			save: crafting.save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "item_busy",
			},
		});
		expect(Object.values(crafting.save.craftJobs)).toHaveLength(1);
	});

	it("rolls producer output from currently active effects at completion", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:replace-output": {
					name: "Replace output",
					operations: [
						{
							kind: "loot.replaceOutput",
							output: [
								{
									itemId: "item:twig",
									quantity: 1,
									type: "guaranteed",
								},
							],
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
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
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					durationMs: 1000,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:replace-output"] = {
			endAtMs: 750,
			effectId: "effect:replace-output",
			id: "effect-instance:replace-output",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};

		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});
		const job = readOnlyRecordValue(started.save.producerJobs);

		const completed = runTick({
			config,
			nowMs: 1500,
			save: started.save,
		});

		expect(completed.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					productId: "product:test",
					type: "product.completed",
				}),
				expect.objectContaining({
					itemId: "item:twig",
					type: "item.created",
				}),
				expect.objectContaining({
					type: "effect.expired",
				}),
			]),
		);
		expect(completed.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemId: "item:plank",
					type: "item.created",
				}),
			]),
		);
	});

	it("does not keep consumed input loot effects after producer input consumption", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:key-replaces-output": {
					name: "Key replaces output",
					operations: [
						{
							kind: "loot.replaceOutput",
							output: [
								{
									itemId: "item:plank",
									quantity: 1,
									type: "guaranteed",
								},
							],
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:shred",
											],
										},
									],
								},
							},
						},
					],
					scope: "global",
					sourceScope: "inventory",
				},
			},
			items: {
				...baseConfig.items,
				"item:key": {
					...baseConfig.items["item:key"],
					passiveEffectIds: [
						"effect:key-replaces-output",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:key",
							quantity: 1,
						},
					],
					output: [
						{
							itemId: "item:twig",
							quantity: 1,
							type: "guaranteed",
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:key",
			quantity: 1,
		};

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(result.save.inventory.slots[0]).toBeNull();
	});

	it("rejects queued producer start when a block effect is active at queued start time", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:block-test": {
					name: "Block test",
					operations: [
						{
							kind: "line.blockStart",
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
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
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:block-test"] = {
			endAtMs: 1500,
			effectId: "effect:block-test",
			id: "effect-instance:block-test",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 500,
		};

		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const second = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save: first.save,
		});

		expect(second._tag).toBe("Left");
		if (second._tag === "Left") {
			expect(second.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "blocked",
			});
		}
	});

	it("does not let consumed input effects block their own producer start", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:twig-blocks-shred": {
					name: "Twig blocks shred",
					operations: [
						{
							kind: "line.blockStart",
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:shred",
											],
										},
									],
								},
							},
						},
					],
					scope: "global",
					sourceScope: "inventory",
				},
			},
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					passiveEffectIds: [
						"effect:twig-blocks-shred",
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(Object.values(result.save.producerJobs)).toHaveLength(1);
		expect(result.save.inventory.slots[0]).toBeNull();
	});

	it("rechecks product-line grants after auto-filled inputs are consumed", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readOwnedTwigGrantConfig(baseConfig, [
			"product:shred",
		]);
		const config = createEngineTestConfig({
			...grantConfig,
			products: {
				...grantConfig.products,
				"product:shred": {
					...grantConfig.products["product:shred"],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "effect:missing-grant",
			});
		}
		expect(save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:twig",
		});
	});

	it("keeps queued producer start times in configured FIFO order", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:early-replace-output": {
					name: "Early replace output",
					operations: [
						{
							kind: "loot.replaceOutput",
							output: [
								{
									itemId: "item:plank",
									quantity: 1,
									type: "guaranteed",
								},
							],
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
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
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:early-replace-output"] = {
			endAtMs: 500,
			effectId: "effect:early-replace-output",
			id: "effect-instance:early-replace-output",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 0,
		};

		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const second = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save: first.save,
		});

		const jobs = Object.values(second.save.producerJobs).sort(
			(left, right) => left.startAtMs - right.startAtMs,
		);
		expect(jobs.map((job) => job.startAtMs)).toEqual([
			0,
			1000,
		]);
	});

	it("rejects queued producer start when the product line is hidden at queued start time", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:hide-test": {
					name: "Hide test",
					operations: [
						{
							kind: "line.hide",
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
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
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.activeEffects["effect-instance:hide-test"] = {
			endAtMs: 2000,
			effectId: "effect:hide-test",
			id: "effect-instance:hide-test",
			sourceItemInstanceId: "item-instance:1",
			startAtMs: 1000,
		};

		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const second = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save: first.save,
		});

		expect(second).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			},
		});
	});

	it("starts active effect product lines as timed producer jobs", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test": {
					name: "Test effect",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 0.5,
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:shred",
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
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					activatesEffectId: "effect:test",
					output: undefined,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const activeEffect = readOnlyRecordValue(result.save.activeEffects);
		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1500,
			producerItemInstanceId: "item-instance:1",
			productId: "product:test",
			startAtMs: 500,
		});
		expect(activeEffect).toMatchObject({
			startAtMs: 500,
			effectId: "effect:test",
			endAtMs: 1500,
			producerJobId: job.id,
			sourceItemInstanceId: "item-instance:1",
		});
		expect(activeEffect.id).toMatch(/^effect-instance:/);
		expect(result.events).toEqual([
			{
				atMs: 500,
				readyAtMs: 1500,
				jobId: job.id,
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				startAtMs: 500,
				type: "product.started",
			},
			{
				atMs: 500,
				startAtMs: 500,
				effectId: "effect:test",
				endAtMs: 1500,
				id: activeEffect.id,
				producerJobId: job.id,
				sourceItemInstanceId: "item-instance:1",
				type: "effect.activated",
			},
		]);
		expect(result.nextWakeAtMs).toBe(1500);
	});

	it("rejects default producer product action when no default line is selected", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			});
		}
	});

	it("rejects hidden producer product lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					visibility: "hidden",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "invalid_actor",
			});
		}
	});

	it("starts the saved default producer product line when productId is omitted", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerLines["item-instance:1"] = {
			defaultProductId: "product:shred",
		};

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				inputRefs: [
					{
						itemInstanceId: "item-instance:2",
						kind: "board",
					},
				],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save: {
				...save,
				board: {
					items: {
						...save.board.items,
						"item-instance:2": {
							id: "item-instance:2",
							itemId: "item:twig",
							x: 1,
							y: 0,
						},
					},
				},
			},
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			producerItemInstanceId: "item-instance:1",
			productId: "product:shred",
		});
		expect(result.events).toContainEqual(
			expect.objectContaining({
				productId: "product:shred",
				type: "product.started",
			}),
		);
	});

	it("accepts local product grants from diagonal neighbors", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			productIds: [
				"product:test",
			],
			radius: 1,
		});
		const config = createEngineTestConfig({
			...grantConfig,
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 2,
				},
			},
			products: {
				...grantConfig.products,
				"product:test": {
					...grantConfig.products["product:test"],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 1,
						y: 1,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result.events).toMatchObject([
			{
				type: "product.started",
			},
		]);
	});

	it("applies local effect duration from nearby board sources", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			effects: {
				...baseConfig.effects,
				"effect:near-twig-duration": {
					name: "Near Twig Duration",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 2,
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
											],
										},
									],
								},
							},
						},
					],
					radius: 2,
					scope: "local",
				},
			},
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					passiveEffectIds: [
						"effect:near-twig-duration",
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 2,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 2500,
			startAtMs: 500,
		});
		expect(result.nextWakeAtMs).toBe(2500);
	});

	it("pauses a running producer while its local grant source is out of range", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			productIds: [
				"product:test",
			],
			radius: 2,
		});
		const config = createEngineTestConfig({
			...grantConfig,
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 4,
				},
			},
			products: {
				...grantConfig.products,
				"product:test": {
					...grantConfig.products["product:test"],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 2,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const job = readOnlyRecordValue(started.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});

		const moved = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 3,
				y: 0,
			},
			config,
			nowMs: 500,
			save: started.save,
		});

		expect(moved.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "product.completed",
				}),
			]),
		);
		expect(moved.save.producerJobs[job.id]).toMatchObject({
			pausedAtMs: 500,
			readyAtMs: 1000,
			remainingMs: 500,
			startAtMs: 0,
		});
		expect(moved.nextWakeAtMs).toBeNull();

		const stillPaused = runTick({
			config,
			nowMs: 2000,
			save: moved.save,
		});
		expect(stillPaused.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "product.completed",
				}),
			]),
		);
		expect(stillPaused.save.producerJobs[job.id]).toMatchObject({
			pausedAtMs: 500,
			remainingMs: 500,
		});
		expect(stillPaused.nextWakeAtMs).toBeNull();

		const resumed = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 2,
				y: 0,
			},
			config,
			nowMs: 2500,
			save: stillPaused.save,
		});
		expect(resumed.save.producerJobs[job.id]).toMatchObject({
			readyAtMs: 3000,
			startAtMs: 2000,
		});
		expect(resumed.save.producerJobs[job.id]?.pausedAtMs).toBeUndefined();
		expect(resumed.save.producerJobs[job.id]?.remainingMs).toBeUndefined();
		expect(resumed.nextWakeAtMs).toBe(3000);
	});

	it("keeps already queued producer jobs behind a newly paused head job until the head resumes", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			productIds: [
				"product:test",
			],
			radius: 1,
		});
		const config = createEngineTestConfig({
			...grantConfig,
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 4,
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
					productIds: [
						"product:test",
						"product:backup",
					],
				},
			},
			products: {
				...grantConfig.products,
				"product:test": {
					...grantConfig.products["product:test"],
				},
				"product:backup": {
					chargeCost: 0,
					durationMs: 1000,
					name: "Backup",
					output: [
						{
							itemId: "item:plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
					placement: "board_then_inventory",
					tags: [],
					visibility: "visible",
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const firstStarted = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const queued = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:backup",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save: firstStarted.save,
		});

		const paused = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 3,
				y: 0,
			},
			config,
			nowMs: 250,
			save: queued.save,
		});
		const pausedJobs = Object.values(paused.save.producerJobs).sort(
			(left, right) => left.startAtMs - right.startAtMs,
		);
		expect(pausedJobs).toHaveLength(2);
		expect(pausedJobs[0]).toMatchObject({
			pausedAtMs: 250,
			productId: "product:test",
			remainingMs: 750,
		});
		expect(pausedJobs[1]).toMatchObject({
			productId: "product:backup",
			readyAtMs: 2000,
			startAtMs: 1000,
		});
		expect(paused.nextWakeAtMs).toBeNull();
		expect(
			GameSaveConfigSchema.safeParse({
				config,
				save: paused.save,
			}).success,
		).toBe(true);

		const resumed = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 1250,
			save: paused.save,
		});
		const resumedJobs = Object.values(resumed.save.producerJobs).sort(
			(left, right) => left.startAtMs - right.startAtMs,
		);
		expect(resumedJobs).toHaveLength(2);
		expect(resumedJobs[0]).toMatchObject({
			pausedAtMs: undefined,
			productId: "product:test",
			readyAtMs: 2000,
			startAtMs: 1000,
		});
		expect(resumedJobs[1]).toMatchObject({
			productId: "product:backup",
			readyAtMs: 3000,
			startAtMs: 2000,
		});
		expect(resumed.nextWakeAtMs).toBe(2000);
	});

	it("pauses a running producer head when a block effect appears before a queued start", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:block-test": {
					name: "Block test",
					operations: [
						{
							kind: "line.blockStart",
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
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
				"item:blocker": {
					assetId: "asset:test",
					description: "Blocker",
					maxStackSize: 1,
					name: "Blocker",
					passiveEffectIds: [
						"effect:block-test",
					],
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:blocker",
			quantity: 1,
		};

		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const queued = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save: first.save,
		});
		const blockedBeforeStart = runAction({
			action: {
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 500,
			save: queued.save,
		});

		const result = blockedBeforeStart;
		const remainingJob = Object.values(result.save.producerJobs).find(
			(job) => job.pausedAtMs === 500 && job.startAtMs === 0,
		);

		expect(remainingJob).toMatchObject({
			pausedAtMs: 500,
			productId: "product:test",
			remainingMs: 500,
			startAtMs: 0,
		});
		expect(result.nextWakeAtMs).toBeNull();

		const blocker = findBoardItem(result.save, {
			itemId: "item:blocker",
			x: 1,
			y: 0,
		});
		expect(blocker).toBeDefined();
		if (!blocker) return;

		const resumed = runAction({
			action: {
				boardItemId: blocker.id,
				type: "board.item.stash",
			},
			config,
			nowMs: 1500,
			save: result.save,
		});
		const resumedJob = Object.values(resumed.save.producerJobs).find(
			(job) => job.startAtMs === 1000 && job.readyAtMs === 2000,
		);
		expect(resumedJob).toMatchObject({
			pausedAtMs: undefined,
			readyAtMs: 2000,
			remainingMs: undefined,
			startAtMs: 1000,
		});
		expect(resumed.nextWakeAtMs).toBe(2000);
	});

	it("keeps queued producer jobs behind a blocked running head", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:block-test": {
					name: "Block test",
					operations: [
						{
							kind: "line.blockStart",
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
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
				"item:blocker": {
					assetId: "asset:test",
					description: "Blocker",
					maxStackSize: 1,
					name: "Blocker",
					passiveEffectIds: [
						"effect:block-test",
					],
					storage: "both",
					tags: [],
					tier: 0,
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:blocker",
			quantity: 1,
		};

		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const queued = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save: first.save,
		});
		const blockedBeforeStart = runAction({
			action: {
				slotIndex: 0,
				type: "inventory.item.place",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 500,
			save: queued.save,
		});

		const result = runTick({
			config,
			nowMs: 1500,
			save: blockedBeforeStart.save,
		});
		const remainingJob = Object.values(result.save.producerJobs).find(
			(job) => job.pausedAtMs === 500 && job.startAtMs === 0,
		);

		expect(remainingJob).toMatchObject({
			pausedAtMs: 500,
			productId: "product:test",
			readyAtMs: 1000,
			remainingMs: 500,
			startAtMs: 0,
		});
		expect(result.nextWakeAtMs).toBeNull();

		const blocker = findBoardItem(result.save, {
			itemId: "item:blocker",
			x: 1,
			y: 0,
		});
		expect(blocker).toBeDefined();
		if (!blocker) return;

		const resumed = runAction({
			action: {
				boardItemId: blocker.id,
				type: "board.item.stash",
			},
			config,
			nowMs: 1600,
			save: result.save,
		});
		const resumedJob = Object.values(resumed.save.producerJobs).find(
			(job) => job.startAtMs === 1100 && job.readyAtMs === 2100,
		);
		expect(resumedJob).toMatchObject({
			pausedAtMs: undefined,
			readyAtMs: 2100,
			remainingMs: undefined,
			startAtMs: 1100,
		});
		expect(resumed.nextWakeAtMs).toBe(2100);
	});

	it("rejects starting another producer job behind a grant-paused first job", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			productIds: [
				"product:test",
			],
			radius: 1,
		});
		const config = createEngineTestConfig({
			...grantConfig,
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 4,
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
					productIds: [
						"product:test",
						"product:backup",
					],
				},
			},
			products: {
				...grantConfig.products,
				"product:test": {
					...grantConfig.products["product:test"],
				},
				"product:backup": {
					chargeCost: 0,
					durationMs: 1000,
					name: "Backup",
					output: [
						{
							itemId: "item:plank",
							quantity: 1,
							type: "guaranteed",
						},
					],
					placement: "board_then_inventory",
					tags: [],
					visibility: "visible",
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const paused = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 3,
				y: 0,
			},
			config,
			nowMs: 250,
			save: started.save,
		});
		expect(readOnlyRecordValue(paused.save.producerJobs)).toMatchObject({
			pausedAtMs: 250,
		});

		const queued = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:backup",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save: paused.save,
		});

		expect(queued).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "producer_queue_full",
			},
		});
	});

	it("does not apply queued active effects while their job is blocked behind a paused queue head", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			productIds: [
				"product:gate",
			],
			radius: 1,
		});
		const config = createEngineTestConfig({
			...grantConfig,
			effects: {
				...grantConfig.effects,
				"effect:block-test": {
					name: "Block test",
					operations: [
						{
							kind: "line.blockStart",
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
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
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 5,
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
					productIds: [
						"product:gate",
						"product:blocker",
						"product:test",
					],
				},
			},
			products: {
				...grantConfig.products,
				"product:gate": {
					...grantConfig.products["product:gate"],
					chargeCost: 0,
					durationMs: 1000,
					name: "Gate",
					output: undefined,
					placement: "board_then_inventory",
					tags: [],
					visibility: "visible",
				},
				"product:blocker": {
					activatesEffectId: "effect:block-test",
					chargeCost: 0,
					durationMs: 1000,
					name: "Blocker",
					output: undefined,
					placement: "board_then_inventory",
					tags: [],
					visibility: "visible",
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:producer",
						x: 4,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const gateStarted = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:gate",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const blockerQueued = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:blocker",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save: gateStarted.save,
		});
		expect(readOnlyRecordValue(blockerQueued.save.activeEffects)).toMatchObject({
			endAtMs: 2000,
			startAtMs: 1000,
		});

		const paused = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 2,
				y: 0,
			},
			config,
			nowMs: 250,
			save: blockerQueued.save,
		});
		expect(paused.nextWakeAtMs).toBeNull();

		const secondProducerStart = runAction({
			action: {
				producerItemInstanceId: "item-instance:3",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 1500,
			save: paused.save,
		});

		expect(
			Object.values(secondProducerStart.save.producerJobs).some(
				(job) =>
					job.producerItemInstanceId === "item-instance:3" &&
					job.productId === "product:test",
			),
		).toBe(true);
	});

	it("pauses a running producer when the producer moves outside its local grant", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			productIds: [
				"product:test",
			],
			radius: 1,
		});
		const config = createEngineTestConfig({
			...grantConfig,
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 5,
				},
			},
			products: {
				...grantConfig.products,
				"product:test": {
					...grantConfig.products["product:test"],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const job = readOnlyRecordValue(started.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});

		const movedAway = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 4,
				y: 0,
			},
			config,
			nowMs: 250,
			save: started.save,
		});
		expect(movedAway.save.producerJobs[job.id]).toMatchObject({
			pausedAtMs: 250,
			remainingMs: 750,
		});
		expect(movedAway.nextWakeAtMs).toBeNull();

		const staleTime = runTick({
			config,
			nowMs: 1000,
			save: movedAway.save,
		});
		expect(staleTime.save.producerJobs[job.id]).toMatchObject({
			pausedAtMs: 250,
			remainingMs: 750,
		});
		expect(staleTime.events).toEqual([]);

		const movedBack = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 1250,
			save: staleTime.save,
		});
		expect(movedBack.save.producerJobs[job.id]).toMatchObject({
			readyAtMs: 2000,
			startAtMs: 1000,
		});
		expect(movedBack.nextWakeAtMs).toBe(2000);
	});

	it("does not expire active producer effects while their grant-paused job is stopped", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			productIds: [
				"product:test",
			],
			radius: 1,
		});
		const config = createEngineTestConfig({
			...grantConfig,
			effects: {
				...grantConfig.effects,
				"effect:test": {
					name: "Test effect",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 0.5,
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:shred",
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
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 5,
				},
			},
			products: {
				...grantConfig.products,
				"product:test": {
					...grantConfig.products["product:test"],
					activatesEffectId: "effect:test",
					output: undefined,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const job = readOnlyRecordValue(started.save.producerJobs);
		const activeEffect = readOnlyRecordValue(started.save.activeEffects);
		expect(activeEffect).toMatchObject({
			endAtMs: 1000,
			producerJobId: job.id,
			startAtMs: 0,
		});

		const paused = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 4,
				y: 0,
			},
			config,
			nowMs: 250,
			save: started.save,
		});
		expect(paused.nextWakeAtMs).toBeNull();

		const expiredWindow = runTick({
			config,
			nowMs: 1000,
			save: paused.save,
		});
		expect(expiredWindow.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "effect.expired",
				}),
			]),
		);
		expect(expiredWindow.save.activeEffects[activeEffect.id]).toBeDefined();

		const resumed = runAction({
			action: {
				boardItemId: "item-instance:1",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 1250,
			save: expiredWindow.save,
		});
		expect(resumed.save.activeEffects[activeEffect.id]).toMatchObject({
			endAtMs: 2000,
			startAtMs: 1000,
		});
		expect(resumed.nextWakeAtMs).toBe(2000);
	});

	it("pauses activated effects when product grants break", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			productIds: [
				"product:boost",
			],
			radius: 1,
		});
		const config = createEngineTestConfig({
			...grantConfig,
			effects: {
				...grantConfig.effects,
				"effect:boost": {
					name: "Boost",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 0.5,
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
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
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 5,
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					productIds: [
						"product:boost",
					],
				},
			},
			products: {
				...grantConfig.products,
				"product:boost": {
					...grantConfig.products["product:boost"],
					activatesEffectId: "effect:boost",
					chargeCost: 0,
					durationMs: 1000,
					name: "Boost",
					placement: "board_then_inventory",
					tags: [],
					visibility: "visible",
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:boost",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const effect = readOnlyRecordValue(started.save.activeEffects);

		const paused = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 4,
				y: 0,
			},
			config,
			nowMs: 250,
			save: started.save,
		});
		expect(readOnlyRecordValue(paused.save.producerJobs)).toMatchObject({
			pausedAtMs: 250,
			remainingMs: 750,
		});

		const expiredWindow = runTick({
			config,
			nowMs: 1100,
			save: paused.save,
		});
		expect(expiredWindow.save.activeEffects[effect.id]).toBeDefined();
		expect(expiredWindow.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "effect.expired",
				}),
			]),
		);

		const resumed = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 0,
				y: 0,
			},
			config,
			nowMs: 1250,
			save: expiredWindow.save,
		});
		expect(resumed.save.activeEffects[effect.id]).toMatchObject({
			endAtMs: 2000,
			startAtMs: 1000,
		});
		expect(resumed.nextWakeAtMs).toBe(2000);
	});

	it("keeps product-line local grants as gates instead of duration mutators", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			productIds: [
				"product:test",
			],
			radius: 2,
		});
		const config = createEngineTestConfig({
			...grantConfig,
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 3,
				},
			},
			products: {
				...grantConfig.products,
				"product:test": {
					...grantConfig.products["product:test"],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 2,
						y: 0,
					},
					{
						itemId: "item:rock",
						x: 0,
						y: 1,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1000,
			startAtMs: 0,
		});
	});

	it("stacks product duration penalties from every active local effect source", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				...baseConfig.effects,
				"effect:twig-proximity-slow": {
					name: "Twig proximity slow",
					operations: [
						{
							durationFactor: 0.5,
							kind: "duration.proximityPenalty",
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
											],
										},
									],
								},
							},
						},
					],
					radius: 2,
					scope: "local",
				},
			},
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 3,
				},
			},
			items: {
				...baseConfig.items,
				"item:twig": {
					...baseConfig.items["item:twig"],
					passiveEffectIds: [
						"effect:twig-proximity-slow",
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 1,
						y: 0,
					},
					{
						itemId: "item:twig",
						x: 2,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 3000,
			startAtMs: 0,
		});
	});

	it("stacks active passive duration effects", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				...baseConfig.effects,
				"effect:rock-slow": {
					name: "Rock slow",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 2,
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
											],
										},
									],
								},
							},
						},
					],
					scope: "global",
					sourceScope: "both",
				},
				"effect:twig-inventory-slow": {
					name: "Twig inventory slow",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 1.5,
							target: {
								productLines: {
									anyOf: [
										{
											ids: [
												"product:test",
											],
										},
									],
								},
							},
						},
					],
					scope: "global",
					sourceScope: "inventory",
				},
			},
			items: {
				...baseConfig.items,
				"item:rock": {
					...baseConfig.items["item:rock"],
					passiveEffectIds: [
						"effect:rock-slow",
					],
				},
				"item:twig": {
					...baseConfig.items["item:twig"],
					passiveEffectIds: [
						"effect:twig-inventory-slow",
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
					{
						itemId: "item:rock",
						x: 1,
						y: 0,
					},
				],
				inventory: [
					{
						itemId: "item:twig",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 3000,
			startAtMs: 0,
		});
	});

	it("rejects missing product local grants", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			productIds: [
				"product:test",
			],
			radius: 1,
		});
		const config = createEngineTestConfig({
			...grantConfig,
			game: {
				...baseConfig.game,
				board: {
					height: 2,
					width: 2,
				},
			},
			products: {
				...grantConfig.products,
				"product:test": {
					...grantConfig.products["product:test"],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "effect:missing-grant",
			});
		}
	});

	it("consumes explicit inventory inputs at product start", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 2,
		};

		const result = runAction({
			action: {
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.events).toMatchObject([
			{
				from: {
					kind: "inventory",
					nextQuantity: 1,
					previousQuantity: 2,
					quantity: 1,
					slotIndex: 0,
				},
				itemId: "item:twig",
				reason: "product-input",
				type: "item.consumed",
			},
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("auto-fills missing producer input from the board before starting the product", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(result.save.producerInputs).toEqual({});
		expect(result.events).toMatchObject([
			{
				from: {
					itemInstanceId: "item-instance:2",
					kind: "board",
				},
				itemId: "item:twig",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				nextQuantity: 1,
				previousQuantity: 0,
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer_input.stored",
			},
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("starts an up-to producer product with one explicit input ref", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 4,
							consume: true,
							itemId: "item:twig",
							mode: "upTo",
							quantity: 4,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};

		const result = runAction({
			action: {
				inputRefs: [
					{
						itemInstanceId: "item-instance:2",
						kind: "board",
					},
				],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(readOnlyRecordValue(result.save.producerJobs)).toMatchObject({
			producerItemInstanceId: "item-instance:1",
			productId: "product:shred",
			startAtMs: 100,
		});
	});

	it("starts an up-to producer product with one stored input", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 4,
							consume: true,
							itemId: "item:twig",
							mode: "upTo",
							quantity: 4,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerInputs["item-instance:1"] = {
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs).toEqual({});
		expect(readOnlyRecordValue(result.save.producerJobs)).toMatchObject({
			producerItemInstanceId: "item-instance:1",
			productId: "product:shred",
			startAtMs: 100,
		});
	});

	it("auto-fills an up-to producer product to its run maximum before starting", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 4,
							consume: true,
							itemId: "item:twig",
							mode: "upTo",
							quantity: 4,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		for (const [index, x] of [
			1,
			2,
			3,
			4,
		].entries()) {
			save.board.items[`item-instance:${index + 2}`] = {
				id: `item-instance:${index + 2}`,
				itemId: "item:twig",
				x,
				y: 0,
			};
		}

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs).toEqual({});
		expect(
			Object.values(result.save.board.items).filter((item) => item.itemId === "item:twig"),
		).toHaveLength(0);
		expect(
			result.events.filter((event) => event.type === "producer_input.stored"),
		).toHaveLength(4);
		expect(readOnlyRecordValue(result.save.producerJobs)).toMatchObject({
			producerItemInstanceId: "item-instance:1",
			productId: "product:shred",
			startAtMs: 100,
		});
	});

	it("leaves an incomplete producer product idle when auto-fill finds no inputs", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs).toEqual({});
		expect(result.save.producerJobs).toEqual({});
		expect(result.events).toEqual([]);
	});

	it("auto-fills available producer inputs without starting an incomplete product", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 2,
							consume: true,
							itemId: "item:twig",
							quantity: 2,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(result.save.producerInputs).toEqual({
			"item-instance:1": {
				productInputs: {
					"product:shred": {
						items: {
							"item:twig": 1,
						},
					},
				},
			},
		});
		expect(result.save.producerJobs).toEqual({});
		expect(result.events).toMatchObject([
			{
				from: {
					itemInstanceId: "item-instance:2",
					kind: "board",
				},
				itemId: "item:twig",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				nextQuantity: 1,
				previousQuantity: 0,
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer_input.stored",
			},
		]);
	});

	it("auto-fills only missing producer input when the product line is partially filled", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 2,
							consume: true,
							itemId: "item:twig",
							quantity: 2,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};
		save.producerInputs["item-instance:1"] = {
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(result.save.producerInputs).toEqual({});
		expect(result.events).toMatchObject([
			{
				from: {
					itemInstanceId: "item-instance:2",
					kind: "board",
				},
				itemId: "item:twig",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				nextQuantity: 2,
				previousQuantity: 1,
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer_input.stored",
			},
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("auto-fills missing producer input from inventory before starting the product", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 2,
		};

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.save.producerInputs).toEqual({});
		expect(result.events).toMatchObject([
			{
				from: {
					kind: "inventory",
					nextQuantity: 1,
					previousQuantity: 2,
					quantity: 1,
					slotIndex: 0,
				},
				itemId: "item:twig",
				reason: "producer-input-auto-fill",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer_input.stored",
			},
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("stores producer line input from inventory and later consumes it on product start", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const stored = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(stored.save.inventory.slots[0]).toBeNull();
		expect(stored.save.producerInputs).toEqual({
			"item-instance:1": {
				productInputs: {
					"product:shred": {
						items: {
							"item:twig": 1,
						},
					},
				},
			},
		});
		expect(stored.events).toMatchObject([
			{
				itemId: "item:twig",
				reason: "producer-input-store",
				type: "item.consumed",
			},
			{
				itemId: "item:twig",
				productId: "product:shred",
				type: "producer_input.stored",
			},
		]);

		const started = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 200,
			save: stored.save,
		});

		expect(started.save.producerInputs).toEqual({});
		expect(started.events).toMatchObject([
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("withdraws an entire producer product-line input through board then inventory placement", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 3,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerInputs["item-instance:1"] = {
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 2,
					},
				},
			},
		};

		const result = runAction({
			action: {
				itemId: "item:twig",
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.input.withdraw",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs).toEqual({});
		expect(
			findBoardItem(result.save, {
				itemId: "item:twig",
				x: 1,
				y: 0,
			}),
		).toBeDefined();
		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.events).toMatchObject([
			{
				itemId: "item:twig",
				previousQuantity: 2,
				productId: "product:shred",
				quantity: 2,
				type: "producer_input.withdrawn",
			},
			{
				itemId: "item:twig",
				reason: "producer-input-withdraw",
				to: {
					kind: "board",
					x: 1,
					y: 0,
				},
				type: "item.created",
			},
			{
				itemId: "item:twig",
				reason: "producer-input-withdraw",
				to: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				type: "item.created",
			},
		]);
	});

	it("keeps producer line input stored when withdraw placement is unavailable", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:rock",
			x: 1,
			y: 0,
		};
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 3,
		};
		save.inventory.slots[1] = {
			itemId: "item:plank",
			quantity: 2,
		};
		save.producerInputs["item-instance:1"] = {
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runActionEither({
			action: {
				itemId: "item:twig",
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.input.withdraw",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result._tag).toBe("Left");
		expect(
			save.producerInputs["item-instance:1"]?.productInputs["product:shred"]?.items,
		).toEqual({
			"item:twig": 1,
		});
	});

	it("stores duplicate producer input into the saved default line before earlier lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					productIds: [
						"product:shred",
						"product:alt-shred",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:alt-shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					name: "Alt shred",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};
		save.producerLines["item-instance:1"] = {
			defaultProductId: "product:alt-shred",
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.productInputs).toEqual({
			"product:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the default line before later matching lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					productIds: [
						"product:shred",
						"product:alt-shred",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:alt-shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					name: "Alt shred",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.productInputs).toEqual({
			"product:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the first product line with remaining capacity", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					productIds: [
						"product:shred",
						"product:alt-shred",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:alt-shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					name: "Alt shred",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};
		save.producerInputs["item-instance:1"] = {
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.productInputs).toEqual({
			"product:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
			"product:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the next product line after the default line is full", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					productIds: [
						"product:shred",
						"product:alt-shred",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:alt-shred": {
					...baseConfig.products["product:shred"],
					inputs: [
						{
							capacity: 1,
							consume: true,
							itemId: "item:twig",
							quantity: 1,
						},
					],
					name: "Alt shred",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};
		save.producerInputs["item-instance:1"] = {
			productInputs: {
				"product:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				producerItemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.productInputs).toEqual({
			"product:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
			"product:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("accepts owned grants from inventory", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readOwnedTwigGrantConfig(baseConfig, [
			"product:test",
		]);
		const config = createEngineTestConfig({
			...grantConfig,
			products: {
				...grantConfig.products,
				"product:test": {
					...grantConfig.products["product:test"],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result.events).toMatchObject([
			{
				type: "product.started",
			},
		]);
	});

	it("fails through the typed error channel when a passive grant is missing", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readOwnedTwigGrantConfig(baseConfig, [
			"product:test",
		]);
		const config = createEngineTestConfig({
			...grantConfig,
			products: {
				...grantConfig.products,
				"product:test": {
					...grantConfig.products["product:test"],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "effect:missing-grant",
			});
		}
	});

	it("queues product jobs for the same producer instead of running them in parallel", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const second = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 600,
			save: first.save,
		});

		const queuedJobs = Object.values(second.save.producerJobs);
		expect(queuedJobs).toHaveLength(2);
		expect(queuedJobs.find((job) => job.startAtMs === 1500)).toMatchObject({
			readyAtMs: 2500,
		});
		expect(second.nextWakeAtMs).toBe(1500);
	});

	it("rejects producer product start when the producer queue is full", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const first = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const second = runActionEither({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				inputRefs: [],
				type: "producer.product.start",
			},
			config,
			nowMs: 600,
			save: first.save,
		});

		expect(second._tag).toBe("Left");
		if (second._tag === "Left") {
			expect(second.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "producer_queue_full",
			});
		}
	});

	it("stores a non-first producer product line as the runtime default", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const defaulted = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(defaulted.save.producerLines).toEqual({
			"item-instance:1": {
				defaultProductId: "product:shred",
			},
		});
		expect(defaulted.events).toEqual([
			{
				atMs: 100,
				nextProductId: "product:shred",
				previousProductId: undefined,
				producerItemInstanceId: "item-instance:1",
				type: "producer.product_line.default_changed",
			},
		]);

		const reset = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 200,
			save: defaulted.save,
		});

		expect(reset.save.producerLines).toEqual({
			"item-instance:1": {
				defaultProductId: "product:test",
			},
		});
		expect(reset.events).toEqual([
			{
				atMs: 200,
				nextProductId: "product:test",
				previousProductId: "product:shred",
				producerItemInstanceId: "item-instance:1",
				type: "producer.product_line.default_changed",
			},
		]);
	});

	it("stores default effect and default product lines independently", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:boost": {
					name: "Boost",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 0.5,
							target: {
								productLines: {
									mode: "all",
								},
							},
						},
					],
					scope: "global",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					productIds: [
						"product:test",
						"product:boost",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:boost": {
					activatesEffectId: "effect:boost",
					chargeCost: 0,
					durationMs: 1000,
					name: "Boost",
					placement: "board_then_inventory",
					tags: [],
					visibility: "visible",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const productDefaulted = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 100,
			save,
		});
		const effectDefaulted = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:boost",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 200,
			save: productDefaulted.save,
		});

		expect(effectDefaulted.save.producerLines).toEqual({
			"item-instance:1": {
				defaultEffectProductId: "product:boost",
				defaultProductId: "product:test",
			},
		});
	});

	it("starts the default effect before the default product and falls back while the effect is active", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:boost": {
					name: "Boost",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 0.5,
							target: {
								productLines: {
									mode: "all",
								},
							},
						},
					],
					scope: "global",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
					productIds: [
						"product:test",
						"product:boost",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:boost": {
					activatesEffectId: "effect:boost",
					chargeCost: 0,
					durationMs: 1000,
					name: "Boost",
					placement: "board_then_inventory",
					tags: [],
					visibility: "visible",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.producerLines["item-instance:1"] = {
			defaultEffectProductId: "product:boost",
			defaultProductId: "product:test",
		};

		const effectStarted = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});
		const effectJob = readOnlyRecordValue(effectStarted.save.producerJobs);
		expect(effectJob).toMatchObject({
			productId: "product:boost",
		});

		const productStarted = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				type: "producer.product.start",
			},
			config,
			nowMs: 600,
			save: effectStarted.save,
		});
		expect(Object.values(productStarted.save.producerJobs)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					productId: "product:boost",
				}),
				expect.objectContaining({
					productId: "product:test",
				}),
			]),
		);
	});

	it("rejects buying the same active effect line again", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:boost": {
					name: "Boost",
					operations: [
						{
							kind: "duration.multiply",
							multiplier: 0.5,
							target: {
								productLines: {
									mode: "all",
								},
							},
						},
					],
					scope: "global",
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					maxQueueSize: 2,
					productIds: [
						"product:test",
						"product:boost",
					],
				},
			},
			products: {
				...baseConfig.products,
				"product:boost": {
					activatesEffectId: "effect:boost",
					chargeCost: 0,
					durationMs: 1000,
					name: "Boost",
					placement: "board_then_inventory",
					tags: [],
					visibility: "visible",
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:boost",
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const rejected = runActionEither({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:boost",
				type: "producer.product.start",
			},
			config,
			nowMs: 600,
			save: started.save,
		});

		expect(rejected._tag).toBe("Left");
		if (rejected._tag === "Left") {
			expect(rejected.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "item_busy",
			});
		}
	});

	it("unsets the runtime default when the selected producer product line is clicked again", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const defaulted = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 100,
			save,
		});
		const unset = runAction({
			action: {
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product_line.set_default",
			},
			config,
			nowMs: 200,
			save: defaulted.save,
		});

		expect(unset.save.producerLines).toEqual({});
		expect(unset.events).toEqual([
			{
				atMs: 200,
				nextProductId: undefined,
				previousProductId: "product:test",
				producerItemInstanceId: "item-instance:1",
				type: "producer.product_line.default_changed",
			},
		]);
	});

	it("replaces a depleted remove-on-charges producer with source-cell output", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 2,
				},
				title: "Test",
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					charges: 1,
					onChargesDepleted: "remove",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					chargeCost: 1,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const completed = runTick({
			config,
			nowMs: started.nextWakeAtMs ?? 1000,
			save: started.save,
		});

		expect(completed.save.board.items["item-instance:1"]).toMatchObject({
			id: "item-instance:1",
			itemId: "item:twig",
			x: 0,
			y: 0,
		});
		expect(completed.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					fromItemId: "item:producer",
					itemInstanceId: "item-instance:1",
					reason: "producer-depleted",
					toItemId: "item:twig",
					type: "item.replaced",
				}),
			]),
		);
		expect(completed.events).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					itemInstanceId: "item-instance:1",
					type: "item.removed",
				}),
			]),
		);
	});

	it("keeps remove-on-depleted producer effects available while delivering its final output", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:producer-output-grant": {
					name: "Producer output grant",
					operations: [
						{
							grantId: "grant:producer-output",
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
			game: {
				id: "game:test",
				inventory: {
					slots: 1,
				},
				board: {
					height: 1,
					width: 2,
				},
				title: "Test",
			},
			items: {
				...baseConfig.items,
				"item:producer": {
					...baseConfig.items["item:producer"],
					passiveEffectIds: [
						"effect:producer-output-grant",
					],
				},
				"item:twig": {
					...baseConfig.items["item:twig"],
					grantSelector: {
						anyOf: [
							{
								ids: [
									"grant:producer-output",
								],
							},
						],
					},
				},
			},
			producers: {
				...baseConfig.producers,
				"item:producer": {
					...baseConfig.producers["item:producer"],
					charges: 1,
					onChargesDepleted: "remove",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					chargeCost: 1,
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:producer",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const started = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const completed = runTick({
			config,
			nowMs: started.nextWakeAtMs ?? 1000,
			save: started.save,
		});

		expect(completed.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					fromItemId: "item:producer",
					itemInstanceId: "item-instance:1",
					reason: "producer-depleted",
					toItemId: "item:twig",
					type: "item.replaced",
				}),
			]),
		);
		expect(Object.values(completed.save.board.items)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "item-instance:1",
					itemId: "item:twig",
					x: 0,
					y: 0,
				}),
				expect.objectContaining({
					itemId: "item:twig",
					x: 1,
					y: 0,
				}),
			]),
		);
		expect(completed.save.producerJobs).toEqual({});
	});
});
