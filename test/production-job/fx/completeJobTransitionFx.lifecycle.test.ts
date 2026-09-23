import { Effect, type Layer } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import type { GameLayerFx } from "~test/support/GameLayerFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";

const outcome = {
	set: [
		{
			rules: [],
			roll: [
				{
					type: "guaranteed" as const,
					outcome: [
						{
							type: "item" as const,
							itemId: "item:gift",
							quantity: {
								min: 1,
								max: 1,
							},
							placement: "drop" as const,
							rules: [],
						},
					],
				},
			],
		},
	],
};

const base = (id: string) => ({
	uid: id,
	id,
	title: id,
	description: id,
	ui: "default" as const,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
});

const lifecycleConfig = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:completion-lifecycle",
		title: "Completion lifecycle",
		board: {
			width: 3,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		"producer:trader": {
			...base("producer:trader"),

			units: {
				amount: 1,
			},
			maxQueueSize: 1,
			lines: [
				{
					id: "line:trader:trade",
					title: "Trade",
					description: "Trade once.",
					runtimeMs: 200,
					input: [
						{
							type: "materials",
							units: {
								from: "self",
								cost: 1,
							},
							query: {
								distance: "far" as const,
								selector: {
									type: "item",
									itemId: "item:material",
								},
							},
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
					outcome,
					rules: [],
				},
				{
					id: "line:trader:stored",
					title: "Stored material",
					description: "Hold material for another trade.",
					runtimeMs: 200,
					input: [
						{
							type: "materials",
							query: {
								distance: "far" as const,
								selector: {
									type: "item",
									itemId: "item:material",
								},
							},
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		"producer:phoenix": {
			...base("producer:phoenix"),

			units: {
				amount: 1,
			},
			maxQueueSize: 1,
			lines: [
				{
					id: "line:phoenix:renew",
					title: "Renew",
					description: "Consume this owner and create a fresh identity.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
					outcome: {
						set: [
							{
								rules: [],
								roll: [
									{
										type: "guaranteed",
										outcome: [
											{
												type: "item" as const,
												itemId: "producer:phoenix",
												quantity: {
													min: 1,
													max: 1,
												},
												placement: "drop",
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
		"producer:finite-queue": {
			...base("producer:finite-queue"),

			units: {
				amount: 2,
			},
			maxQueueSize: 3,
			lines: [
				{
					id: "line:finite-queue:work",
					title: "Finite queue work",
					description: "Runs only while the owner has units.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		"blueprint:empty": {
			...base("blueprint:empty"),
			maxQueueSize: 1,

			units: {
				amount: 1,
			},
			lines: [
				{
					id: "line:blueprint:empty",
					title: "Build nothing",
					description: "Completes without outcome.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		"craft:repeatable": {
			maxQueueSize: 1,

			...base("craft:repeatable"),

			lines: [
				{
					id: "line:craft:repeatable",
					title: "Repeat",
					description: "Repeat without consuming the owner.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					outcome,
					rules: [],
				},
			],
		},
		"item:material": {
			maxQueueSize: 1,
			lines: [],

			...base("item:material"),

			units: {
				amount: 2,
			},
		},
		"item:gift": {
			maxQueueSize: 1,
			lines: [],

			...base("item:gift"),
		},
	},
});

const run = <A, E>(effect: Effect.Effect<A, E, Layer.Success<ReturnType<typeof GameLayerFx>>>) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: lifecycleConfig,
			}),
		),
	);

describe("job completion unit lifecycle", () => {
	it("removes a depleted producer and its remaining queue", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:finite-queue",
					itemId: "producer:finite-queue",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				const blockedOwner = yield* spawnItemFx({
					id: "runtime:blocked-trader",
					itemId: "producer:trader",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
				});
				for (let index = 0; index < 3; index += 1) {
					yield* enqueueLineFx({
						ownerItemId: owner.id,
						lineId: "line:finite-queue:work",
					});
				}
				const blockedRequest = yield* enqueueLineFx({
					ownerItemId: blockedOwner.id,
					lineId: "line:trader:trade",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 400,
				});
				return {
					blockedOwner,
					blockedRequest,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.runtime.items.map((item) => item.id)).toEqual([
			result.blockedOwner.id,
		]);
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.jobQueue).toEqual([
			result.blockedRequest,
		]);
	});

	it("removes a depleted producer after placing outcome", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:trader",
					itemId: "producer:trader",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				const material = yield* spawnItemFx({
					id: "runtime:material",
					itemId: "item:material",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
				});
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId: "line:trader:trade",
					inputIndex: 0,
					sourceItemId: material.id,
					sourceItemRevision: material.revision,
				});
				yield* spawnItemFx({
					id: "runtime:material:spare",
					itemId: "item:material",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
				});

				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:trader:trade",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.some((item) => item.item.id === "producer:trader")).toBe(false);
		expect(runtime.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:gift",
					}),
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				}),
				expect.objectContaining({
					item: expect.objectContaining({
						id: "item:material",
					}),
				}),
			]),
		);
	});

	it("preserves one impure stored input after depleted-owner outputs claim priority", () => {
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			},
			currentSpace: 0,
			templateUidBySpace: {},
			items: [
				{
					id: "runtime:trader",
					itemId: "producer:trader",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					remainingUnits: 0,
				},
				{
					id: "runtime:consumed-material",
					itemId: "item:material",
					location: {
						scope: "job",
						jobId: "job:trader",
						inputIndex: 0,
					},
				},
				{
					id: "runtime:buffered-material",
					itemId: "item:material",
					location: {
						scope: "input",
						ownerItemId: "runtime:trader",
						lineId: "line:trader:stored",
						inputIndex: 0,
					},
					remainingUnits: 1,
				},
			],
			jobQueue: [],
			jobs: [
				{
					id: "job:trader",
					ownerItemId: "runtime:trader",
					lineId: "line:trader:trade",
					durationMs: 200,
					remainingMs: 200,
				},
			],
		} satisfies StateSchema.Type;
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config: lifecycleConfig,
					state,
				}),
			),
		);

		expect(runtime.items.some((item) => item.id === "runtime:trader")).toBe(false);
		expect(runtime.items.find((item) => item.item.id === "item:gift")).toMatchObject({
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
		});
		expect(runtime.items.find((item) => item.id === "runtime:buffered-material")).toMatchObject(
			{
				remainingUnits: 1,
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 1,
						y: 0,
					},
				},
			},
		);
	});

	it("allows a depleted blueprint to complete without any outcome", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:empty-blueprint",
					itemId: "blueprint:empty",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:empty",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items).toEqual([]);
		expect(runtime.jobs).toEqual([]);
	});

	it("keeps a craft owner and allows the same line to start again", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:craft",
					itemId: "craft:repeatable",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:repeatable",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const restarted = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:craft:repeatable",
				});
				return {
					restarted,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.restarted.type).toBe("started");
		expect(result.runtime.items.some((item) => item.item.id === "craft:repeatable")).toBe(true);
		expect(result.runtime.items.filter((item) => item.item.id === "item:gift")).toHaveLength(1);
	});
});
