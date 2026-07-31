import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { startFx } from "~/engine/start/write/startFx";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { lineRunRuntime, lineRunTestConfig } from "~test/line/fx/run/support/lineRunTestRuntime";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const readLines = (
	runtime: RuntimeSchema.Type,
	itemId = "runtime:workshop",
	config: GameConfigSchema.Type = lineRunTestConfig,
) =>
	Effect.runSync(
		readItemDetailLinesFx({
			itemId,
			runtime,
		}).pipe(Effect.provideService(GameConfigFx, config)),
	);

const focusLine = (lineId: string, show = true) => ({
	id: lineId,
	title: lineId,
	description: lineId,
	show,
	enable: true,
	runtimeMs: 1_000,
	input: [
		{
			type: "simple" as const,
		},
	],
	rules: [],
});

const focusConfig = GameConfigSchema.parse({
	...lineRunTestConfig,
	items: {
		...lineRunTestConfig.items,
		workshop: {
			...lineRunTestConfig.items.workshop,
			lines: [
				focusLine("line:first"),
				focusLine("line:second"),
				focusLine("line:hidden", false),
			],
		},
	},
});

const focusRuntime = ({
	jobQueue = [],
	jobs = [],
}: {
	readonly jobQueue?: NonNullable<RuntimeSchema.Type["jobQueue"]>;
	readonly jobs?: RuntimeSchema.Type["jobs"];
}) => {
	const runtime = lineRunRuntime({});
	return {
		...runtime,
		items: runtime.items.map((item) =>
			item.id === "runtime:workshop"
				? {
						...item,
						item: focusConfig.items.workshop,
					}
				: item,
		),
		jobQueue,
		jobs,
	} satisfies RuntimeSchema.Type;
};

describe("readItemDetailLinesFx", () => {
	it("projects the active line before the earliest queued line", () => {
		const lines = readLines(
			focusRuntime({
				jobs: [
					{
						id: "job:active",
						ownerItemId: "runtime:workshop",
						lineId: "line:first",
						durationMs: 1_000,
						remainingMs: 500,
					},
				],
				jobQueue: [
					{
						id: "queue:earliest",
						ownerItemId: "runtime:workshop",
						lineId: "line:second",
					},
				],
			}),
			"runtime:workshop",
			focusConfig,
		);

		expect(lines).toMatchObject({
			kind: "available",
			focusLineId: "line:first",
		});
	});

	it("projects the earliest queued line once under canonical FIFO order", () => {
		const lines = readLines(
			focusRuntime({
				jobQueue: [
					{
						id: "queue:earliest",
						ownerItemId: "runtime:workshop",
						lineId: "line:second",
					},
					{
						id: "queue:duplicate",
						ownerItemId: "runtime:workshop",
						lineId: "line:second",
					},
					{
						id: "queue:later",
						ownerItemId: "runtime:workshop",
						lineId: "line:first",
					},
				],
			}),
			"runtime:workshop",
			focusConfig,
		);

		expect(lines).toMatchObject({
			kind: "available",
			focusLineId: "line:second",
		});
	});

	it("does not replace a stale earliest queue target with another visible line", () => {
		const lines = readLines(
			focusRuntime({
				jobQueue: [
					{
						id: "queue:hidden",
						ownerItemId: "runtime:workshop",
						lineId: "line:hidden",
					},
					{
						id: "queue:visible",
						ownerItemId: "runtime:workshop",
						lineId: "line:second",
					},
				],
			}),
			"runtime:workshop",
			focusConfig,
		);

		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.focusLineId).toBeUndefined();
	});

	it("uses canonical visibility, enable, input readiness, and effective runtime", () => {
		const blocked = readLines(
			lineRunRuntime({
				permit: true,
				booster: true,
				water: [
					2,
				],
			}),
		);
		expect(blocked.kind).toBe("available");
		if (blocked.kind !== "available") throw new Error("Expected available lines.");
		expect(blocked.line).toHaveLength(1);
		expect(blocked.line[0]).toMatchObject({
			lineId: "line:workshop:build",
			baseRuntimeMs: 1_000,
			effectiveRuntimeMs: 500,
			availability: {
				kind: "available",
				readiness: "inputs",
			},
			input: [
				{
					kind: "materials",
					storedQuantity: 2,
					required: {
						min: 3,
						max: 3,
					},
					missingQuantity: 1,
					availableCapacity: 3,
					ready: false,
				},
			],
		});

		const ready = readLines(
			lineRunRuntime({
				permit: true,
				booster: true,
				water: [
					2,
					1,
				],
			}),
		);
		expect(ready.kind).toBe("available");
		if (ready.kind !== "available") throw new Error("Expected available lines.");
		expect(ready.line[0]?.availability).toEqual({
			kind: "available",
			readiness: "ready",
		});
	});

	it("aggregates only outbound delivery allocations for the exact material slot", () => {
		const runtime = lineRunRuntime({
			permit: true,
		});
		const delivery = (id: string, x: number) => ({
			id,
			item: lineRunTestConfig.items.water,
			location: {
				scope: "delivery" as const,
				phase: "outbound" as const,
				generation: 0,
				origin: {
					scope: "board" as const,
					space: 0,
					position: {
						x,
						y: 0,
					},
				},
				target: {
					kind: "line-input" as const,
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					input: [
						{
							inputIndex: 0,
							quantity: 1,
						},
					],
				},
			},
			quantity: 1,
			revision: `revision:${id}`,
		});
		const lines = readLines({
			...runtime,
			items: [
				...runtime.items,
				delivery("runtime:delivery:first", 4),
				delivery("runtime:delivery:second", 5),
				{
					...delivery("runtime:delivery:returning", 6),
					location: {
						scope: "delivery",
						phase: "returning",
						generation: 1,
						origin: {
							scope: "board",
							space: 0,
							position: {
								x: 6,
								y: 0,
							},
						},
						returnFrom: {
							scope: "board",
							space: 0,
							position: {
								x: 0,
								y: 0,
							},
						},
					},
				},
			],
		});
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line[0]?.input[0]).toMatchObject({
			kind: "materials",
			storedQuantity: 0,
			deliveryQuantity: 2,
			autofillAvailableQuantity: 1,
			required: {
				min: 3,
				max: 3,
			},
		});
	});

	it("keeps unclaimed and returning delivery quantities available while stacks travel", () => {
		const runtime = lineRunRuntime({
			permit: true,
		});
		const outbound = {
			id: "runtime:delivery:outbound",
			item: lineRunTestConfig.items.water,
			location: {
				scope: "delivery" as const,
				phase: "outbound" as const,
				generation: 0,
				origin: {
					scope: "board" as const,
					space: 0,
					position: {
						x: 4,
						y: 0,
					},
				},
				target: {
					kind: "line-input" as const,
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					input: [
						{
							inputIndex: 0,
							quantity: 3,
						},
					],
				},
			},
			quantity: 7,
			revision: "revision:delivery:outbound",
		};
		const returning = {
			...outbound,
			id: "runtime:delivery:returning",
			location: {
				scope: "delivery" as const,
				phase: "returning" as const,
				generation: 1,
				origin: {
					scope: "toolbar" as const,
					position: {
						x: 0,
						y: 0,
					},
				},
				returnFrom: {
					scope: "board" as const,
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
			},
			quantity: 2,
			revision: "revision:delivery:returning",
		};
		const lines = readLines({
			...runtime,
			items: [
				...runtime.items,
				outbound,
				returning,
			],
		});
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line[0]?.input[0]).toMatchObject({
			kind: "materials",
			deliveryQuantity: 3,
			autofillAvailableQuantity: 6,
		});
	});

	it("reports material quantity available to autofill and a direct producer fallback", () => {
		const boardWater = {
			id: "runtime:water:board",
			item: lineRunTestConfig.items.water,
			location: {
				scope: "board" as const,
				space: 0,
				position: {
					x: 2,
					y: 0,
				},
			},
			quantity: 4,
			revision: "revision:water:board",
		};
		const toolbarWater = {
			...boardWater,
			id: "runtime:water:toolbar",
			location: {
				scope: "toolbar" as const,
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 3,
			revision: "revision:water:toolbar",
		};
		const inventoryWater = {
			...boardWater,
			id: "runtime:water:inventory",
			location: {
				scope: "inventory" as const,
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 2,
			revision: "revision:water:inventory",
		};
		const available = readLines({
			...lineRunRuntime({
				permit: true,
			}),
			items: [
				...lineRunRuntime({
					permit: true,
				}).items,
				boardWater,
				toolbarWater,
				inventoryWater,
			],
		});
		if (available.kind !== "available") throw new Error("Expected available lines.");
		expect(available.line[0]?.input[0]).toMatchObject({
			kind: "materials",
			autofillAvailableQuantity: 9,
		});
		expect(available.line[0]?.input[0]).not.toHaveProperty("producerItemId");

		const producerConfig = GameConfigSchema.parse({
			...lineRunTestConfig,
			items: {
				...lineRunTestConfig.items,
				pump: {
					...lineRunTestConfig.items.workshop,
					uid: "pump",
					id: "pump",
					title: "Pump",
					description: "Produces water.",
					lines: [
						{
							id: "line:pump:water",
							title: "Pump Water",
							description: "Produces water.",
							show: true,
							enable: true,
							runtimeMs: 1_000,
							input: [
								{
									type: "simple",
								},
							],
							output: {
								set: [
									{
										roll: [
											{
												type: "guaranteed",
												drop: [
													{
														itemId: "water",
														quantity: {
															type: "value",
															value: 1,
														},
														rules: [],
													},
												],
											},
										],
									},
								],
							},
							rules: [],
						},
					],
				},
			},
		});
		const baseRuntime = lineRunRuntime({
			permit: true,
		});
		const producerItem = {
			id: "runtime:pump",
			item: producerConfig.items.pump,
			location: {
				scope: "board" as const,
				space: 0,
				position: {
					x: 3,
					y: 0,
				},
			},
			quantity: 1,
			revision: "revision:pump",
		};
		const fallback = readLines(
			{
				...baseRuntime,
				items: [
					...baseRuntime.items,
					producerItem,
				],
			},
			"runtime:workshop",
			producerConfig,
		);
		if (fallback.kind !== "available") throw new Error("Expected available lines.");
		expect(fallback.line[0]?.input[0]).toMatchObject({
			kind: "materials",
			autofillAvailableQuantity: 0,
			producerItemId: "runtime:pump",
		});
	});

	it("updates the exact failed rule cause live and gives disable veto deterministic priority", () => {
		const job = {
			id: "job:workshop",
			ownerItemId: "runtime:workshop",
			lineId: "line:workshop:build",
			durationMs: 1_000,
			remainingMs: 400,
		} as const;
		const missingPermit = readLines({
			...lineRunRuntime({
				permit: false,
			}),
			jobs: [
				job,
			],
		});
		const disableVeto = readLines({
			...lineRunRuntime({
				blocker: true,
				permit: false,
			}),
			jobs: [
				job,
			],
		});
		const enabled = readLines({
			...lineRunRuntime({
				permit: true,
			}),
			jobs: [
				job,
			],
		});
		if (
			missingPermit.kind !== "available" ||
			disableVeto.kind !== "available" ||
			enabled.kind !== "available"
		) {
			throw new Error("Expected live line projections.");
		}

		expect(missingPermit.line[0]?.availability).toEqual({
			kind: "unavailable",
			reason: {
				kind: "line-disabled",
				cause: {
					kind: "enable-rule",
					ruleIndex: 2,
					whenIndex: 0,
					when: {
						type: "exists",
						query: {
							scope: "any",
							selector: {
								type: "item",
								itemId: "permit",
							},
						},
					},
				},
			},
		});
		expect(disableVeto.line[0]?.availability).toEqual({
			kind: "unavailable",
			reason: {
				kind: "line-disabled",
				cause: {
					kind: "disable-rule",
					ruleIndex: 3,
					when: [
						{
							type: "exists",
							query: {
								scope: "any",
								selector: {
									type: "item",
									itemId: "blocker",
								},
							},
						},
						{
							type: "exists",
							query: {
								scope: "any",
								selector: {
									type: "item",
									itemId: "blocker",
								},
							},
						},
					],
				},
			},
		});
		expect(enabled.line[0]?.availability).toMatchObject({
			kind: "available",
		});
	});

	it("keeps an active hidden-by-default line inspectable while its owner is stored", () => {
		const runtime = lineRunRuntime({
			permit: false,
		});
		const stored = {
			...runtime,
			items: runtime.items.map((item) =>
				item.id === "runtime:workshop"
					? {
							...item,
							location: {
								scope: "toolbar" as const,
								position: {
									x: 0,
									y: 0,
								},
							},
						}
					: item,
			),
			jobs: [
				{
					id: "job:workshop",
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					durationMs: 1_000,
					remainingMs: 400,
				},
			],
		} satisfies RuntimeSchema.Type;
		const lines = readLines(stored);
		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line).toMatchObject([
			{
				availability: {
					kind: "unavailable",
					reason: {
						kind: "owner-stored",
					},
				},
				activeJob: {
					status: JobStatusEnumSchema.enum.Paused,
					remainingMs: 400,
				},
			},
		]);
	});

	it("projects active work as running, paused, or ready from canonical job truth", () => {
		const job = {
			id: "job:workshop",
			ownerItemId: "runtime:workshop",
			lineId: "line:workshop:build",
			durationMs: 1_000,
			remainingMs: 400,
		} as const;
		const running = readLines({
			...lineRunRuntime({
				permit: true,
			}),
			jobs: [
				job,
			],
		});
		const paused = readLines({
			...lineRunRuntime({
				blocker: true,
				permit: true,
			}),
			jobs: [
				job,
			],
		});
		const ready = readLines({
			...lineRunRuntime({
				permit: true,
			}),
			jobs: [
				{
					...job,
					remainingMs: 0,
				},
			],
		});

		for (const projection of [
			running,
			paused,
			ready,
		]) {
			expect(projection.kind).toBe("available");
		}
		if (
			running.kind !== "available" ||
			paused.kind !== "available" ||
			ready.kind !== "available"
		) {
			throw new Error("Expected available lines.");
		}
		expect(running.line[0]?.activeJob?.status).toBe(JobStatusEnumSchema.enum.Running);
		expect(paused.line[0]?.activeJob?.status).toBe(JobStatusEnumSchema.enum.Paused);
		expect(ready.line[0]?.activeJob?.status).toBe(JobStatusEnumSchema.enum.AwaitingOutput);
	});

	it("keeps single-slot owners on a disabled Start action while work is active", () => {
		const base = lineRunRuntime({
			permit: true,
			water: [
				2,
				1,
			],
		});
		const runtime = {
			...base,
			items: base.items.map((item) =>
				item.id === "runtime:workshop" && item.item.type === "producer"
					? {
							...item,
							item: {
								...item.item,
								maxQueueSize: 1,
							},
						}
					: item,
			),
			jobs: [
				{
					id: "job:workshop",
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
					durationMs: 1_000,
					remainingMs: 400,
				},
			],
		} satisfies RuntimeSchema.Type;

		const lines = readLines(runtime);
		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line[0]).toMatchObject({
			availability: {
				kind: "available",
				readiness: "queue",
			},
			actions: {},
		});
	});

	it("sums the real charges of every eligible nearby deposit", async () => {
		const config = await readArkiniGameConfigSource();
		const lines = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* readRuntimeFx();
				return yield* readItemDetailLinesFx({
					itemId: "runtime:lumberjack",
					runtime,
				});
			}).pipe(
				useGameFx({
					config,
					state: {
						cheats: {
							enabled: false,
							everEnabled: false,
							instantGameplay: false,
						},
						currentSpace: 0,
						items: [
							{
								id: "runtime:lumberjack",
								itemId: "producer:lumberjack-t1",
								location: {
									scope: "board",
									space: 0,
									position: {
										x: 1,
										y: 1,
									},
								},
								quantity: 1,
							},
							{
								id: "runtime:tree:full",
								itemId: "item:tree",
								location: {
									scope: "board",
									space: 0,
									position: {
										x: 1,
										y: 0,
									},
								},
								quantity: 1,
							},
							{
								id: "runtime:tree:five",
								itemId: "item:tree",
								location: {
									scope: "board",
									space: 0,
									position: {
										x: 0,
										y: 1,
									},
								},
								quantity: 1,
								remainingCharges: 5,
							},
							{
								id: "runtime:tree:ten",
								itemId: "item:tree",
								location: {
									scope: "board",
									space: 0,
									position: {
										x: 1,
										y: 2,
									},
								},
								quantity: 1,
								remainingCharges: 10,
							},
							{
								id: "runtime:tree:far",
								itemId: "item:tree",
								location: {
									scope: "board",
									space: 0,
									position: {
										x: 12,
										y: 8,
									},
								},
								quantity: 1,
								remainingCharges: 7,
							},
						],
						jobs: [],
					},
				}),
			),
		);

		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(
			lines.line
				.find((line) => line.lineId === "line:lumberjack-t1:log")
				?.input.find((input) => input.kind === "deposit"),
		).toMatchObject({
			kind: "deposit",
			requiredCharges: 1,
			availableCharges: 33,
			ready: true,
		});
	});

	it("hides a Well blueprint source line after one unspent Well blueprint exists", async () => {
		const config = await readArkiniGameConfigSource();
		const lines = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* readRuntimeFx();
				return yield* readItemDetailLinesFx({
					itemId: "runtime:library",
					runtime,
				});
			}).pipe(
				useGameFx({
					config,
					state: {
						cheats: {
							enabled: false,
							everEnabled: false,
							instantGameplay: false,
						},
						currentSpace: 0,
						items: [
							{
								id: "runtime:library",
								itemId: "producer:library-t1",
								location: {
									scope: "board",
									space: 0,
									position: {
										x: 0,
										y: 0,
									},
								},
								quantity: 1,
							},
							{
								id: "runtime:well-blueprint",
								itemId: "item:blueprint-well-t1",
								location: {
									scope: "inventory",
									position: {
										x: 0,
										y: 0,
									},
								},
								quantity: 1,
							},
						],
						jobs: [],
					},
				}),
			),
		);

		expect(lines).toMatchObject({
			kind: "available",
			line: expect.arrayContaining([
				expect.objectContaining({
					lineId: "line:library-t1:blueprint-well-t1",
					availability: {
						kind: "unavailable",
						reason: {
							kind: "downstream-output-max-count",
							intermediateItemId: "item:blueprint-well-t1",
							itemId: "producer:well-t1",
							liveQuantity: 0,
							reservedQuantity: 2,
							maxCount: 1,
						},
					},
				}),
			]),
		});
	});

	it("distinguishes a missing deposit target from a present target with insufficient charges", async () => {
		const config = await readArkiniGameConfigSource();
		const lumberjack = config.items["producer:lumberjack-t1"];
		if (lumberjack?.type !== "producer") throw new Error("Missing lumberjack definition.");
		const testConfig = GameConfigSchema.parse({
			...config,
			items: {
				...config.items,
				[lumberjack.id]: {
					...lumberjack,
					lines: lumberjack.lines.map((line) =>
						line.id === "line:lumberjack-t1:log-double-tree"
							? {
									...line,
									input: [
										...line.input,
										...line.input,
									],
								}
							: line,
					),
				},
			},
		});
		const read = (includeDepletedTarget: boolean) =>
			Effect.runSync(
				Effect.gen(function* () {
					const runtime = yield* readRuntimeFx();
					return yield* readItemDetailLinesFx({
						itemId: "runtime:lumberjack",
						runtime,
					});
				}).pipe(
					useGameFx({
						config: testConfig,
						state: {
							cheats: {
								enabled: false,
								everEnabled: false,
								instantGameplay: false,
							},
							currentSpace: 0,
							items: [
								{
									id: "runtime:lumberjack",
									itemId: "producer:lumberjack-t1",
									location: {
										scope: "board",
										space: 0,
										position: {
											x: 1,
											y: 1,
										},
									},
									quantity: 1,
								},
								...(includeDepletedTarget
									? [
											{
												id: "runtime:double-tree",
												itemId: "item:double-tree",
												location: {
													scope: "board" as const,
													space: 0,
													position: {
														x: 1,
														y: 0,
													},
												},
												quantity: 1,
												remainingCharges: 1,
											},
										]
									: []),
							],
							jobs: [],
						},
					}),
				),
			);
		const missing = read(false);
		const depleted = read(true);
		if (missing.kind !== "available" || depleted.kind !== "available") {
			throw new Error("Expected lumberjack lines.");
		}
		const missingLine = missing.line.find(
			(line) => line.lineId === "line:lumberjack-t1:log-double-tree",
		);
		const depletedLine = depleted.line.find(
			(line) => line.lineId === "line:lumberjack-t1:log-double-tree",
		);

		expect(missingLine).toMatchObject({
			availability: {
				kind: "unavailable",
				reason: {
					kind: "deposit-target-missing",
					distance: "close",
					selector: {
						type: "item",
						itemId: "item:double-tree",
					},
				},
			},
			input: [
				{
					kind: "deposit",
					availableCharges: 0,
					requiredCharges: 2,
					targetItemIds: [],
					ready: false,
				},
			],
		});
		expect(depletedLine).toMatchObject({
			availability: {
				kind: "available",
				readiness: "inputs",
			},
			input: [
				{
					kind: "deposit",
					availableCharges: 1,
					requiredCharges: 2,
					targetItemIds: [
						"runtime:double-tree",
					],
					ready: false,
				},
			],
		});
	});

	it("groups duplicate drops without flattening guaranteed and chance rolls", () => {
		const config = GameConfigSchema.parse({
			version: "1.0",
			resources: {
				hero: "hero",
			},
			meta: {
				id: "game:tile-lines-output",
				title: "Tile lines output",
				board: {
					width: 1,
					height: 1,
				},
				inventory: {
					width: 1,
					height: 1,
				},
			},
			start: {
				currentSpace: 0,
				board: [
					{
						itemId: "workshop",
						space: 0,
						x: 0,
						y: 0,
					},
				],
			},
			categories: {},
			items: {
				workshop: {
					uid: "workshop",
					id: "workshop",
					type: "producer",
					title: "Workshop",
					description: "Produces grouped output.",
					asset: {
						default: [
							"asset:workshop",
						],
					},
					tags: [],
					categoryId: "building",
					scope: "board",
					maxStackSize: 1,
					maxQueueSize: 1,
					lines: [
						{
							id: "line:workshop:output",
							title: "Output",
							description: "Produces output.",
							show: true,
							enable: true,
							runtimeMs: 1_000,
							input: [
								{
									type: "simple",
								},
							],
							rules: [],
							output: {
								set: [
									{
										roll: [
											{
												type: "guaranteed",
												drop: [
													{
														itemId: "wood",
														quantity: {
															type: "value",
															value: 2,
														},
														rules: [],
													},
													{
														itemId: "wood",
														quantity: {
															type: "range",
															min: 1,
															max: 3,
														},
														rules: [],
													},
												],
											},
											{
												type: "chance",
												chance: 0.25,
												drop: [
													{
														itemId: "gem",
														quantity: {
															type: "value",
															value: 1,
														},
														rules: [],
													},
												],
											},
										],
									},
								],
							},
						},
					],
				},
				wood: {
					uid: "wood",
					id: "wood",
					type: "simple",
					title: "Wood",
					description: "Wood.",
					asset: {
						default: [
							"asset:wood",
						],
					},
					tags: [],
					categoryId: "resource",
					scope: "any",
					maxStackSize: 10,
				},
				gem: {
					uid: "gem",
					id: "gem",
					type: "simple",
					title: "Gem",
					description: "Gem.",
					asset: {
						default: [
							"asset:gem",
						],
					},
					tags: [],
					categoryId: "resource",
					scope: "any",
					maxStackSize: 10,
				},
			},
		});
		const runtime = Effect.runSync(
			startFx().pipe(
				useGameFx({
					config,
				}),
			),
		);
		const ownerId = runtime.items[0]?.id;
		if (ownerId === undefined) throw new Error("Missing output owner.");
		const lines = readLines(runtime, ownerId, config);
		expect(lines.kind).toBe("available");
		if (lines.kind !== "available") throw new Error("Expected available lines.");
		expect(lines.line[0]?.output).toEqual([
			{
				weight: 1,
				roll: [
					{
						kind: "guaranteed",
						item: [
							{
								itemId: "wood",
								quantity: {
									min: 3,
									max: 5,
								},
							},
						],
					},
					{
						kind: "chance",
						chance: 0.25,
						item: [
							{
								itemId: "gem",
								quantity: {
									min: 1,
									max: 1,
								},
							},
						],
					},
				],
			},
		]);
	});

	it("returns unavailable for stale and non-line identities", () => {
		const runtime = lineRunRuntime({});
		expect(readLines(runtime, "runtime:missing")).toEqual({
			kind: "unavailable",
		});
		const water = runtime.items.find(
			(item) => item.item.id === lineRunTestConfig.items.water.id,
		);
		if (water !== undefined) {
			expect(readLines(runtime, water.id)).toEqual({
				kind: "unavailable",
			});
		}
	});
});
