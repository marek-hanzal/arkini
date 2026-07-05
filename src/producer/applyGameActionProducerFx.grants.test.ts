import { describe, expect, it } from "vitest";
import {
	createEngineTestConfig,
	GameSaveConfigSchema,
	readLocalTwigGrantConfig,
	readOnlyRecordValue,
	readOwnedTwigGrantConfig,
	runAction,
	runActionEither,
	runInitialSave,
	runTick,
} from "./applyGameActionProducerFx.testSupport";

describe("applyGameActionFx Producer grants", () => {
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
});
