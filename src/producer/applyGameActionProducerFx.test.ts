import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createEngineCraftTableTestConfig } from "~/engine/test/createEngineCraftTableTestConfig";
import { GameSaveConfigSchema } from "~/engine/model/GameSaveSchema";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { runGameTickFx } from "~/engine/runGameTickFx";
import { TestRandomService } from "~/engine/test/TestRandomService";
import { withRandomService } from "~/random/logic/withRandomService";
import {
	findBoardItem,
	readOnlyRecordValue,
	runAction,
	runActionEither,
	runInitialSave,
} from "~/engine/applyGameActionFx.testSupport";

const runTick = (props: runGameTickFx.Props) =>
	Effect.runSync(runGameTickFx(props).pipe(withRandomService(TestRandomService)));

type TestConfig = ReturnType<typeof createEngineTestConfig>;
type TestLine = TestConfig["lineCatalog"][string];
type TestOutputEntry = NonNullable<TestLine["output"]>[number];
type TestOutputEffect = NonNullable<
	Exclude<
		TestOutputEntry,
		{
			type: "weighted";
		}
	>["effects"]
>[number];

const appendFirstOutputEffects = (
	line: TestLine | undefined,
	effects: readonly TestOutputEffect[],
): TestLine => {
	if (!line) throw new Error("Missing test line.");
	const [firstOutput, ...remainingOutput] = line.output ?? [
		{
			itemId: "item:plank",
			quantity: 1,
			type: "guaranteed" as const,
		},
	];
	if (firstOutput.type === "weighted") {
		throw new Error("Test helper only supports non-weighted first outputs.");
	}

	return {
		...line,
		output: [
			{
				...firstOutput,
				effects: [
					...(firstOutput.effects ?? []),
					...effects,
				],
			},
			...remainingOutput,
		],
	};
};

const readOwnedTwigGrantConfig = (
	baseConfig: ReturnType<typeof createEngineTestConfig>,
	lineIds: readonly string[],
) => {
	const grantId = "grant:test:owned-twig";
	const effectId = "effect:test:owned-twig-grant";
	return {
		itemEffects: {
			"item:twig": [
				{
					id: effectId,
					polarity: "neutral" as const,
					grants: [
						{
							id: grantId,
							name: "Test grant",
						},
					],
					name: "Owned Twig Grant",
					sourceScope: "both" as const,
				},
			],
		},
		lineOverrides: {
			...Object.fromEntries(
				lineIds.map((lineId) => [
					lineId,
					appendFirstOutputEffects(baseConfig.lineCatalog[lineId], [
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
					]),
				]),
			),
		},
	};
};

const readLocalTwigGrantConfig = (
	baseConfig: ReturnType<typeof createEngineTestConfig>,
	props: {
		lineIds: readonly string[];
		radius: number;
	},
) => ({
	lineOverrides: {
		...Object.fromEntries(
			props.lineIds.map((lineId) => [
				lineId,
				appendFirstOutputEffects(baseConfig.lineCatalog[lineId], [
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
				]),
			]),
		),
	},
});

describe("applyGameActionFx Producer", () => {
	it("starts a no-input line as an Effect action", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const job = readOnlyRecordValue(result.save.producerJobs);
		expect(job).toMatchObject({
			readyAtMs: 1500,
			itemInstanceId: "item-instance:1",
			lineId: "line:test",
			startAtMs: 500,
		});
		expect(result.events).toEqual([
			{
				atMs: 500,
				readyAtMs: 1500,
				jobId: job.id,
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				startAtMs: 500,
				type: "line.started",
			},
		]);
		expect(result.nextWakeAtMs).toBe(1500);
	});

	it("rejects products whose only output is blocked before planning or consuming inputs", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			itemEffects: {
				"item:axe": [
					{
						id: "effect:test:block",
						grants: [
							{
								id: "grant:test:block",
								name: "Block grant",
							},
						],
						name: "Block Grant",
						polarity: "debuff",
						sourceScope: "inventory",
					},
				],
			},
			lineOverrides: {
				"line:shred": appendFirstOutputEffects(baseConfig.lineCatalog["line:shred"], [
					{
						display: "always",
						kind: "grant.blockStart",
						label: "Blocked by Axe",
						selector: {
							allOf: [
								{
									ids: [
										"grant:test:block",
									],
								},
							],
						},
					},
				]),
			},
			startingState: {
				...baseConfig.startingState,
				inventory: [
					{
						itemId: "item:axe",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "effect:disabled-output",
			},
		});
	});

	it("rejects products whose visible output drops are all disabled by drop-owned effects", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			itemEffects: {
				"item:empty-stash": [
					{
						id: "effect:test:unlock",
						polarity: "neutral",
						grants: [
							{
								id: "grant:test:unlock",
								name: "Unlock grant",
							},
						],
						name: "Unlock Grant",
					},
				],
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							itemId: "item:twig",
							quantity: 1,
							type: "guaranteed",
							effects: [
								{
									display: "always",
									kind: "grant.require",
									label: "Unlock Twig Drop",
									phase: "start",
									selector: {
										allOf: [
											{
												ids: [
													"grant:test:unlock",
												],
											},
										],
									},
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "effect:disabled-output",
			},
		});
	});

	it("completes zero-duration lines in the same action", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
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
				lineId: "line:test",
				type: "line.started",
			}),
			expect.objectContaining({
				atMs: 500,
				lineId: "line:test",
				type: "line.completed",
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
					assetIds: [
						"asset:test",
					],
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
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:blueprint-plank": {
					durationMs: 0,
					inputs: [],
					resultItemId: "item:plank",
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
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

	it("rejects blueprint producer output when the crafted target is reserved by an existing blueprint", () => {
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
					assetIds: [
						"asset:test",
					],
					description: "Plank blueprint",
					maxStackSize: 3,
					storage: "both",
					name: "Plank Blueprint",
					tags: [
						"blueprint",
					],
					tier: 0,
				},
			},
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:blueprint-plank": {
					durationMs: 0,
					inputs: [],
					resultItemId: "item:plank",
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
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
						itemId: "item:blueprint-plank",
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
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

	it("rejects blueprint producer output when the crafted target is reserved by an inventory blueprint", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					maxCount: 1,
				},
				"item:blueprint-plank": {
					assetIds: [
						"asset:test",
					],
					description: "Plank blueprint",
					maxStackSize: 3,
					storage: "both",
					name: "Plank Blueprint",
					tags: [
						"blueprint",
					],
					tier: 0,
				},
			},
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:blueprint-plank": {
					durationMs: 0,
					inputs: [],
					resultItemId: "item:plank",
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
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
				],
				inventory: [
					{
						itemId: "item:blueprint-plank",
						quantity: 1,
					},
				],
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
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

	it("rejects blueprint producer output when an existing producer job already reserves the crafted target", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			items: {
				...baseConfig.items,
				"item:plank": {
					...baseConfig.items["item:plank"],
					maxCount: 1,
				},
				"item:blueprint-plank": {
					assetIds: [
						"asset:test",
					],
					description: "Plank blueprint",
					maxStackSize: 3,
					storage: "both",
					name: "Plank Blueprint",
					tags: [
						"blueprint",
					],
					tier: 0,
				},
			},
			craftOverrides: {
				...baseConfig.craftCatalog,
				"item:blueprint-plank": {
					durationMs: 0,
					inputs: [],
					resultItemId: "item:plank",
				},
			},
			producerOverrides: {
				"item:producer": {
					maxQueueSize: 2,
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					durationMs: 1000,
					output: [
						{
							itemId: "item:blueprint-plank",
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
		const first = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		const second = runActionEither({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 200,
			save: first.save,
		});

		expect(second).toMatchObject({
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
			craftOverrides: {
				...baseConfig.craftCatalog,
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
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

	it("rechecks line grants after auto-filled inputs are consumed", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readOwnedTwigGrantConfig(baseConfig, [
			"line:shred",
		]);
		const config = createEngineTestConfig({
			...grantConfig,
			lineOverrides: {
				"line:shred": {
					...grantConfig.lineOverrides["line:shred"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "effect:disabled-output",
			});
		}
		expect(save.board.items["item-instance:2"]).toMatchObject({
			itemId: "item:twig",
		});
	});

	it("rejects default line action when no default line is selected", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				itemInstanceId: "item-instance:1",
				inputRefs: [],
				type: "line.start",
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

	it("rejects hidden lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				inputRefs: [],
				type: "line.start",
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

	it("starts the saved default line when lineId is omitted", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.lines["item-instance:1"] = {
			defaultLineId: "line:shred",
		};

		const result = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				inputRefs: [
					{
						itemInstanceId: "item-instance:2",
						kind: "board",
					},
				],
				type: "line.start",
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
			itemInstanceId: "item-instance:1",
			lineId: "line:shred",
		});
		expect(result.events).toContainEqual(
			expect.objectContaining({
				lineId: "line:shred",
				type: "line.started",
			}),
		);
	});

	it("accepts local product grants from diagonal neighbors", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			lineIds: [
				"line:test",
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
			lineOverrides: {
				"line:test": {
					...grantConfig.lineOverrides["line:test"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result.events).toMatchObject([
			{
				type: "line.started",
			},
		]);
	});

	it("pauses a running producer while its local grant source is out of range", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			lineIds: [
				"line:test",
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
			lineOverrides: {
				"line:test": {
					...grantConfig.lineOverrides["line:test"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
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
					type: "line.completed",
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
					type: "line.completed",
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
			lineIds: [
				"line:test",
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
			producerOverrides: {
				"item:producer": {
					maxQueueSize: 2,
					lines: [
						baseConfig.lineCatalog["line:test"],
						{
							chargeCost: 0,
							durationMs: 1000,
							id: "line:backup",
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
					],
				},
			},
			lineOverrides: {
				"line:test": {
					...grantConfig.lineOverrides["line:test"],
				},
				"line:backup": {
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const queued = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:backup",
				inputRefs: [],
				type: "line.start",
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
			lineId: "line:test",
			remainingMs: 750,
		});
		expect(pausedJobs[1]).toMatchObject({
			lineId: "line:backup",
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
			lineId: "line:test",
			readyAtMs: 2000,
			startAtMs: 1000,
		});
		expect(resumedJobs[1]).toMatchObject({
			lineId: "line:backup",
			readyAtMs: 3000,
			startAtMs: 2000,
		});
		expect(resumed.nextWakeAtMs).toBe(2000);
	});

	it("rejects starting another producer job behind a grant-paused first job", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			lineIds: [
				"line:test",
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
			producerOverrides: {
				"item:producer": {
					maxQueueSize: 2,
					lines: [
						baseConfig.lineCatalog["line:test"],
						{
							chargeCost: 0,
							durationMs: 1000,
							id: "line:backup",
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
					],
				},
			},
			lineOverrides: {
				"line:test": {
					...grantConfig.lineOverrides["line:test"],
				},
				"line:backup": {
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
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
				itemInstanceId: "item-instance:1",
				lineId: "line:backup",
				inputRefs: [],
				type: "line.start",
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

	it("pauses a running producer when all visible drop-owned outputs become disabled", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			game: {
				...baseConfig.game,
				board: {
					height: 1,
					width: 5,
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							effects: [
								{
									display: "always",
									items: {
										anyOf: [
											{
												ids: [
													"item:axe",
												],
											},
										],
									},
									kind: "nearby.require",
									label: "Nearby Axe Unlocks Drop",
									phase: "start",
									radius: 1,
								},
							],
							itemId: "item:twig",
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
						itemId: "item:axe",
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
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 0,
			save,
		});
		const job = readOnlyRecordValue(started.save.producerJobs);

		const movedAway = runAction({
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
		expect(staleTime.events).toEqual([]);
		expect(staleTime.save.producerJobs[job.id]).toMatchObject({
			pausedAtMs: 250,
			remainingMs: 750,
		});

		const movedBack = runAction({
			action: {
				boardItemId: "item-instance:2",
				type: "board.item.move",
				x: 1,
				y: 0,
			},
			config,
			nowMs: 1250,
			save: staleTime.save,
		});
		expect(movedBack.save.producerJobs[job.id]).toMatchObject({
			pausedAtMs: undefined,
			readyAtMs: 2000,
			startAtMs: 1000,
		});
		expect(movedBack.nextWakeAtMs).toBe(2000);
	});

	it("pauses a running producer when the producer moves outside its local grant", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			lineIds: [
				"line:test",
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
			lineOverrides: {
				"line:test": {
					...grantConfig.lineOverrides["line:test"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
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

	it("keeps line local grants as gates instead of duration mutators", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readLocalTwigGrantConfig(baseConfig, {
			lineIds: [
				"line:test",
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
			lineOverrides: {
				"line:test": {
					...grantConfig.lineOverrides["line:test"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
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
			lineIds: [
				"line:test",
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
			lineOverrides: {
				"line:test": {
					...grantConfig.lineOverrides["line:test"],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "effect:disabled-output",
			});
		}
	});

	it("consumes explicit inventory inputs at line start", () => {
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
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
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
				reason: "line-input",
				type: "item.consumed",
			},
			{
				lineId: "line:shred",
				type: "line.started",
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
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
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
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "producer_input.stored",
			},
			{
				lineId: "line:shred",
				type: "line.started",
			},
		]);
	});

	it("starts an up-to line with one explicit input ref", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(readOnlyRecordValue(result.save.producerJobs)).toMatchObject({
			itemInstanceId: "item-instance:1",
			lineId: "line:shred",
			startAtMs: 100,
		});
	});

	it("starts an up-to line with one stored input", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
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
			lineInputs: {
				"line:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs).toEqual({});
		expect(readOnlyRecordValue(result.save.producerJobs)).toMatchObject({
			itemInstanceId: "item-instance:1",
			lineId: "line:shred",
			startAtMs: 100,
		});
	});

	it("auto-fills an up-to line to its run maximum before starting", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
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
			itemInstanceId: "item-instance:1",
			lineId: "line:shred",
			startAtMs: 100,
		});
	});

	it("leaves an incomplete line idle when auto-fill finds no inputs", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
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
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.board.items["item-instance:2"]).toBeUndefined();
		expect(result.save.producerInputs).toEqual({
			"item-instance:1": {
				lineInputs: {
					"line:shred": {
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
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "producer_input.stored",
			},
		]);
	});

	it("auto-fills only missing producer input when the line is partially filled", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
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
			lineInputs: {
				"line:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runAction({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
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
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "producer_input.stored",
			},
			{
				lineId: "line:shred",
				type: "line.started",
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
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.start",
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
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "producer_input.stored",
			},
			{
				lineId: "line:shred",
				type: "line.started",
			},
		]);
	});

	it("stores line input from inventory and later consumes it on line start", () => {
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
				itemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(stored.save.inventory.slots[0]).toBeNull();
		expect(stored.save.producerInputs).toEqual({
			"item-instance:1": {
				lineInputs: {
					"line:shred": {
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
				lineId: "line:shred",
				type: "producer_input.stored",
			},
		]);

		const started = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 200,
			save: stored.save,
		});

		expect(started.save.producerInputs).toEqual({});
		expect(started.events).toMatchObject([
			{
				lineId: "line:shred",
				type: "line.started",
			},
		]);
	});

	it("withdraws an entire line input through board then inventory placement", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			lineOverrides: {
				"line:shred": {
					...baseConfig.lineCatalog["line:shred"],
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
			lineInputs: {
				"line:shred": {
					items: {
						"item:twig": 2,
					},
				},
			},
		};

		const result = runAction({
			action: {
				itemId: "item:twig",
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
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
				lineId: "line:shred",
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

	it("keeps line input stored when withdraw placement is unavailable", () => {
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
			lineInputs: {
				"line:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};

		const result = runActionEither({
			action: {
				itemId: "item:twig",
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "producer.input.withdraw",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result._tag).toBe("Left");
		expect(save.producerInputs["item-instance:1"]?.lineInputs["line:shred"]?.items).toEqual({
			"item:twig": 1,
		});
	});

	it("stores duplicate producer input into the saved default line before earlier lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producerOverrides: {
				"item:producer": {
					maxQueueSize: baseConfig.producerCatalog["item:producer"].maxQueueSize,
					lines: [
						baseConfig.lineCatalog["line:shred"],
						{
							...baseConfig.lineCatalog["line:shred"],
							id: "line:alt-shred",
							name: "Alt shred",
						},
					],
				},
			},
			lineOverrides: {
				"line:alt-shred": {
					...baseConfig.lineCatalog["line:shred"],
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
		save.lines["item-instance:1"] = {
			defaultLineId: "line:alt-shred",
		};

		const result = runAction({
			action: {
				inputRef: {
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
				itemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.lineInputs).toEqual({
			"line:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the default line before later matching lines", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producerOverrides: {
				"item:producer": {
					maxQueueSize: baseConfig.producerCatalog["item:producer"].maxQueueSize,
					lines: [
						baseConfig.lineCatalog["line:shred"],
						{
							...baseConfig.lineCatalog["line:shred"],
							id: "line:alt-shred",
							name: "Alt shred",
						},
					],
				},
			},
			lineOverrides: {
				"line:alt-shred": {
					...baseConfig.lineCatalog["line:shred"],
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
				itemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.lineInputs).toEqual({
			"line:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the first line with remaining capacity", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producerOverrides: {
				"item:producer": {
					maxQueueSize: baseConfig.producerCatalog["item:producer"].maxQueueSize,
					lines: [
						baseConfig.lineCatalog["line:shred"],
						{
							...baseConfig.lineCatalog["line:shred"],
							id: "line:alt-shred",
							name: "Alt shred",
						},
					],
				},
			},
			lineOverrides: {
				"line:alt-shred": {
					...baseConfig.lineCatalog["line:shred"],
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
			lineInputs: {
				"line:shred": {
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
				itemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.lineInputs).toEqual({
			"line:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
			"line:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("stores duplicate producer input into the next line after the default line is full", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producerOverrides: {
				"item:producer": {
					maxQueueSize: baseConfig.producerCatalog["item:producer"].maxQueueSize,
					lines: [
						baseConfig.lineCatalog["line:shred"],
						{
							...baseConfig.lineCatalog["line:shred"],
							id: "line:alt-shred",
							name: "Alt shred",
						},
					],
				},
			},
			lineOverrides: {
				"line:alt-shred": {
					...baseConfig.lineCatalog["line:shred"],
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
			lineInputs: {
				"line:shred": {
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
				itemInstanceId: "item-instance:1",
				type: "producer.input.store",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.producerInputs["item-instance:1"]?.lineInputs).toEqual({
			"line:alt-shred": {
				items: {
					"item:twig": 1,
				},
			},
			"line:shred": {
				items: {
					"item:twig": 1,
				},
			},
		});
	});

	it("accepts owned grants from inventory", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readOwnedTwigGrantConfig(baseConfig, [
			"line:test",
		]);
		const config = createEngineTestConfig({
			...grantConfig,
			lineOverrides: {
				"line:test": {
					...grantConfig.lineOverrides["line:test"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result.events).toMatchObject([
			{
				type: "line.started",
			},
		]);
	});

	it("fails through the typed error channel when a passive grant is missing", () => {
		const baseConfig = createEngineTestConfig();
		const grantConfig = readOwnedTwigGrantConfig(baseConfig, [
			"line:test",
		]);
		const config = createEngineTestConfig({
			...grantConfig,
			lineOverrides: {
				"line:test": {
					...grantConfig.lineOverrides["line:test"],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result._tag).toBe("Left");
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "effect:disabled-output",
			});
		}
	});

	it("queues product jobs for the same producer instead of running them in parallel", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			producerOverrides: {
				"item:producer": {
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const second = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 600,
			save: first.save,
		});

		const jobs = Object.values(second.save.producerJobs);
		expect(jobs).toHaveLength(2);
		expect(jobs.find((job) => job.startAtMs === 1500)).toMatchObject({
			readyAtMs: 2500,
		});
		expect(second.nextWakeAtMs).toBe(1500);
	});

	it("rejects line start when the producer queue is full", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const first = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
			},
			config,
			nowMs: 500,
			save,
		});

		const second = runActionEither({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				inputRefs: [],
				type: "line.start",
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

	it("stores a non-first line as the runtime default", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const defaulted = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:shred",
				type: "line.set_default",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(defaulted.save.lines).toEqual({
			"item-instance:1": {
				defaultLineId: "line:shred",
			},
		});
		expect(defaulted.events).toEqual([
			{
				atMs: 100,
				nextLineId: "line:shred",
				previousLineId: undefined,
				itemInstanceId: "item-instance:1",
				type: "line.default_changed",
			},
		]);

		const reset = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.set_default",
			},
			config,
			nowMs: 200,
			save: defaulted.save,
		});

		expect(reset.save.lines).toEqual({
			"item-instance:1": {
				defaultLineId: "line:test",
			},
		});
		expect(reset.events).toEqual([
			{
				atMs: 200,
				nextLineId: "line:test",
				previousLineId: "line:shred",
				itemInstanceId: "item-instance:1",
				type: "line.default_changed",
			},
		]);
	});

	it("unsets the runtime default when the selected line is clicked again", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		const defaulted = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.set_default",
			},
			config,
			nowMs: 100,
			save,
		});
		const unset = runAction({
			action: {
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.set_default",
			},
			config,
			nowMs: 200,
			save: defaulted.save,
		});

		expect(unset.save.lines).toEqual({});
		expect(unset.events).toEqual([
			{
				atMs: 200,
				nextLineId: undefined,
				previousLineId: "line:test",
				itemInstanceId: "item-instance:1",
				type: "line.default_changed",
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
			producerOverrides: {
				"item:producer": {
					charges: 1,
					onChargesDepleted: "remove",
				},
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
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
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
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
