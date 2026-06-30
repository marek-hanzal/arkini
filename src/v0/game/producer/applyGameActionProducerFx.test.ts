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
				grantIds: [
					grantId,
				],
				name: "Owned Twig Grant",
				sourceScope: "both" as const,
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
						effects: [
							...(baseConfig.products[productId]?.effects ?? []),
							{
								display: "always" as const,
								kind: "grant.require" as const,
								phase: "start" as const,
								selector: {
									allOf: [
										{
											ids: [
												grantId,
											],
										},
									],
								},
							},
						],
					},
				]),
			),
		},
	};
};

const readLocalTwigGrantConfig = (
	baseConfig: ReturnType<typeof createEngineTestConfig>,
	props: {
		productIds: readonly string[];
		radius: number;
	},
) => ({
	products: {
		...baseConfig.products,
		...Object.fromEntries(
			props.productIds.map((productId) => [
				productId,
				{
					...baseConfig.products[productId],
					effects: [
						...(baseConfig.products[productId]?.effects ?? []),
						{
							display: "always" as const,
							items: {
								anyOf: [
									{
										ids: [
											"item:twig",
										],
									},
								],
							},
							kind: "nearby.require" as const,
							phase: "start" as const,
							radius: props.radius,
						},
					],
				},
			]),
		),
	},
});

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
});
