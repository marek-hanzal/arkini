import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { checkRuntimeFx } from "~/engine/runtime/check/checkRuntimeFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";

const output = {
	set: [
		{
			roll: [
				{
					type: "guaranteed" as const,
					drop: [
						{
							itemId: "item:gift",
							quantity: {
								type: "value" as const,
								value: 1,
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
	id,
	title: id,
	description: id,
	asset: {
		source: [
			`asset:${id}`,
		],
	},
	tags: [],
	categoryId: "test",
	scope: "board" as const,
	maxStackSize: 1,
});

const lifecycleConfig = GameConfigSchema.parse({
	version: "1.0",
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
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	categories: {},
	items: {
		"producer:trader": {
			...base("producer:trader"),
			type: "producer",
			charges: {
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
							charges: {
								from: "self",
								cost: 1,
							},
							selector: {
								type: "item",
								itemId: "item:material",
							},
							quantity: {
								type: "value",
								value: 1,
							},
							capacity: 1,
						},
					],
					output,
					rules: [],
				},
			],
		},
		"producer:phoenix": {
			...base("producer:phoenix"),
			type: "producer",
			charges: {
				amount: 1,
			},
			maxCount: 1,
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
							charges: {
								from: "self",
								cost: 1,
							},
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
												itemId: "producer:phoenix",
												quantity: {
													type: "value",
													value: 1,
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
		"blueprint:empty": {
			...base("blueprint:empty"),
			type: "blueprint",
			charges: {
				amount: 1,
			},
			line: {
				id: "line:blueprint:empty",
				title: "Build nothing",
				description: "Completes without output.",
				runtimeMs: 200,
				input: [
					{
						type: "simple",
						charges: {
							from: "self",
							cost: 1,
						},
					},
				],
				rules: [],
			},
		},
		"craft:repeatable": {
			...base("craft:repeatable"),
			type: "craft",
			line: {
				id: "line:craft:repeatable",
				title: "Repeat",
				description: "Repeat without consuming the owner.",
				runtimeMs: 200,
				input: [
					{
						type: "simple",
					},
				],
				output,
				rules: [],
			},
		},
		"item:material": {
			...base("item:material"),
			type: "simple",
			charges: {
				amount: 2,
			},
			maxStackSize: 2,
		},
		"item:gift": {
			...base("item:gift"),
			type: "simple",
		},
	},
});

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: lifecycleConfig,
			}),
		) as Effect.Effect<A, E, never>,
	);

describe("charge-driven completion lifecycle", () => {
	it("removes a depleted producer and releases buffered input after placing output", () => {
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
					quantity: 1,
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
					quantity: 2,
				});
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId: "line:trader:trade",
					inputIndex: 0,
					sourceItemId: material.id,
					sourceItemRevision: material.revision,
					quantity: 2,
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
					quantity: 1,
				}),
			]),
		);
	});

	it("preserves one impure buffered input after depleted-owner outputs claim priority", () => {
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
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
					remainingCharges: 0,
					quantity: 1,
				},
				{
					id: "runtime:consumed-material",
					itemId: "item:material",
					location: {
						scope: "job",
						jobId: "job:trader",
					},
					quantity: 1,
				},
				{
					id: "runtime:buffered-material",
					itemId: "item:material",
					location: {
						scope: "input",
						ownerItemId: "runtime:trader",
						lineId: "line:trader:trade",
						inputIndex: 0,
					},
					remainingCharges: 1,
					quantity: 1,
				},
			],
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
				remainingCharges: 1,
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

	it("allows a depleted blueprint to complete without any output", () => {
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
					quantity: 1,
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
					quantity: 1,
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

	it("reserves only the net maxCount increase when a depleted owner reproduces itself", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:phoenix",
					itemId: "producer:phoenix",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				const started = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:phoenix:renew",
				});
				const activeRuntime = yield* readRuntimeFx();
				const activeCheck = yield* checkRuntimeFx({
					runtime: activeRuntime,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					activeCheck,
					owner,
					runtime: yield* readRuntimeFx(),
					started,
				};
			}),
		);

		expect(result.started.type).toBe("started");
		expect(result.activeCheck.issues.some((issue) => issue.type === "item:max-count")).toBe(
			false,
		);
		const phoenixes = result.runtime.items.filter(
			(item) => item.item.id === "producer:phoenix",
		);
		expect(phoenixes).toHaveLength(1);
		expect(phoenixes[0]?.id).not.toBe(result.owner.id);
	});
});
