import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { completeJobRuntimeFx } from "~/engine/job/fx/completeJobRuntimeFx";
import { readPlannedLineNetMaximumOutputQuantitiesFx } from "~/engine/job/fx/read/readPlannedLineNetMaximumOutputQuantitiesFx";
import { readReservedJobOutputQuantitiesFx } from "~/engine/job/fx/read/readReservedJobOutputQuantitiesFx";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import { resolveOneHopLineOutputMaxCountFx } from "~/engine/job/fx/read/resolveOneHopLineOutputMaxCountFx";
import { startLineFx } from "~/engine/job/write/startLineFx";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import { placeDropFx } from "~/engine/placement/write/placeDropFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { setItemQuantityFx } from "~/engine/runtime/write/setItemQuantityFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";

const simpleItem = ({
	id,
	maxCount,
	scope = "board",
	maxStackSize = 1,
}: {
	id: string;
	maxCount?: number;
	scope?: "any" | "board";
	maxStackSize?: number;
}) => ({
	id,
	type: "simple" as const,
	title: id,
	description: id,
	asset: {
		source: [
			`asset:${id}`,
		],
	},
	tags: [],
	categoryId: "test",
	scope,
	maxCount,
	maxStackSize,
});

const blueprintItem = ({
	id,
	lineId,
	output,
	reserveTool = false,
}: {
	id: string;
	lineId: string;
	output?: unknown;
	reserveTool?: boolean;
}) => ({
	id,
	type: "blueprint" as const,
	charges: {
		amount: 1,
	},
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
	line: {
		id: lineId,
		title: lineId,
		description: lineId,
		runtimeMs: 200,
		input: reserveTool
			? [
					{
						type: "materials" as const,
						charges: {
							from: "self" as const,
							cost: 1,
						},
						selector: {
							type: "item" as const,
							itemId: "item:tool",
						},
						mode: "reserve" as const,
						quantity: {
							type: "value" as const,
							value: 1,
						},
					},
				]
			: [
					{
						type: "simple" as const,
						charges: {
							from: "self" as const,
							cost: 1,
						},
					},
				],
		output,
		rules: [],
	},
});

const guaranteedOutput = (
	drops: ReadonlyArray<{
		itemId: string;
		quantity: unknown;
		placement?: "drop";
	}>,
) => ({
	set: [
		{
			roll: [
				{
					type: "guaranteed" as const,
					drop: drops.map(({ itemId, quantity, placement = "drop" }) => ({
						itemId,
						quantity,
						placement,
						rules: [],
					})),
				},
			],
		},
	],
});

const blueprintOutput = (
	primaryItemId: string,
	byproducts: ReadonlyArray<{
		itemId: string;
		quantity: unknown;
	}> = [],
) =>
	guaranteedOutput([
		{
			itemId: primaryItemId,
			quantity: {
				type: "value" as const,
				value: 1,
			},
			placement: "drop",
		},
		...byproducts,
	]);

const blueprintConfig = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:blueprint-completion",
		title: "Blueprint completion",
		board: {
			width: 3,
			height: 2,
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
		"blueprint:plain": blueprintItem({
			id: "blueprint:plain",
			lineId: "line:blueprint:plain",
			output: blueprintOutput("item:target"),
		}),
		"blueprint:capped": {
			...blueprintItem({
				id: "blueprint:capped",
				lineId: "line:blueprint:capped",
				output: blueprintOutput("item:target"),
			}),
			maxCount: 1,
		},
		"blueprint:output": blueprintItem({
			id: "blueprint:output",
			lineId: "line:blueprint:output",
			output: blueprintOutput("item:target-unlimited", [
				{
					itemId: "item:byproduct",
					quantity: {
						type: "value",
						value: 1,
					},
				},
			]),
		}),
		"blueprint:reserve": blueprintItem({
			id: "blueprint:reserve",
			lineId: "line:blueprint:reserve",
			output: blueprintOutput("item:target-unlimited", [
				{
					itemId: "item:byproduct",
					quantity: {
						type: "value",
						value: 1,
					},
				},
			]),
			reserveTool: true,
		}),
		"blueprint:range": blueprintItem({
			id: "blueprint:range",
			lineId: "line:blueprint:range",
			output: blueprintOutput("item:target-unlimited", [
				{
					itemId: "item:limited",
					quantity: {
						type: "range",
						min: 1,
						max: 5,
					},
				},
			]),
		}),
		"blueprint:depletion-capped": {
			...blueprintItem({
				id: "blueprint:depletion-capped",
				lineId: "line:blueprint:depletion-capped",
				output: blueprintOutput("item:target-unlimited"),
				reserveTool: true,
			}),
			charges: {
				amount: 1,
				output: blueprintOutput("item:depletion-product"),
			},
		},
		"blueprint:depletion-self": {
			...blueprintItem({
				id: "blueprint:depletion-self",
				lineId: "line:blueprint:depletion-self",
				output: blueprintOutput("item:target-unlimited"),
				reserveTool: true,
			}),
			charges: {
				amount: 1,
				output: blueprintOutput("blueprint:depletion-self"),
			},
			maxCount: 1,
		},
		"blueprint:depletion-random": {
			...blueprintItem({
				id: "blueprint:depletion-random",
				lineId: "line:blueprint:depletion-random",
				output: blueprintOutput("item:target-unlimited"),
				reserveTool: true,
			}),
			charges: {
				amount: 1,
				output: {
					set: [
						{
							roll: [
								{
									type: "weight",
									quantity: {
										type: "value",
										value: 1,
									},
									drop: [
										{
											weight: 1,
											drop: [
												{
													itemId: "item:target-unlimited",
													quantity: {
														type: "value",
														value: 1,
													},
													placement: "drop",
													rules: [],
												},
											],
										},
										{
											weight: 1,
											drop: [
												{
													itemId: "item:depletion-product",
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
					],
				},
			},
		},
		"blueprint:depletion-self-no-output": {
			...blueprintItem({
				id: "blueprint:depletion-self-no-output",
				lineId: "line:blueprint:depletion-self-no-output",
				output: blueprintOutput("blueprint:depletion-self-no-output"),
				reserveTool: true,
			}),
			maxCount: 1,
		},
		"blueprint:hop-a": blueprintItem({
			id: "blueprint:hop-a",
			lineId: "line:blueprint:hop-a",
			output: blueprintOutput("blueprint:hop-b"),
		}),
		"blueprint:hop-b": blueprintItem({
			id: "blueprint:hop-b",
			lineId: "line:blueprint:hop-b",
			output: guaranteedOutput([
				{
					itemId: "blueprint:hop-a",
					quantity: {
						type: "value",
						value: 1,
					},
				},
				{
					itemId: "item:target",
					quantity: {
						type: "value",
						value: 1,
					},
				},
			]),
		}),
		"item:target": simpleItem({
			id: "item:target",
			maxCount: 1,
		}),
		"item:target-unlimited": simpleItem({
			id: "item:target-unlimited",
		}),
		"item:byproduct": simpleItem({
			id: "item:byproduct",
			maxCount: 2,
			maxStackSize: 2,
		}),
		"item:limited": simpleItem({
			id: "item:limited",
			maxCount: 4,
		}),
		"item:depletion-product": simpleItem({
			id: "item:depletion-product",
			maxCount: 1,
		}),
		"item:tool": simpleItem({
			id: "item:tool",
		}),
		"item:blocker": simpleItem({
			id: "item:blocker",
		}),
		"item:queue-product": simpleItem({
			id: "item:queue-product",
			maxCount: 1,
		}),
		"item:shared": simpleItem({
			id: "item:shared",
			maxCount: 2,
		}),
		"producer:limited": {
			id: "producer:limited",
			type: "producer",
			title: "Limited producer",
			description: "Produces one singleton output.",
			asset: {
				source: [
					"asset:producer:limited",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 2,
			lines: [
				{
					id: "line:producer:limited",
					title: "Produce",
					description: "Produce one singleton.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: guaranteedOutput([
						{
							itemId: "item:queue-product",
							quantity: {
								type: "value",
								value: 1,
							},
						},
					]),
					rules: [],
				},
			],
		},
		"producer:blueprint-source": {
			id: "producer:blueprint-source",
			type: "producer",
			title: "Blueprint source",
			description: "Produces one purpose-bound blueprint.",
			asset: {
				source: [
					"asset:producer:blueprint-source",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 2,
			lines: [
				{
					id: "line:producer:blueprint-source",
					title: "Produce blueprint",
					description: "Produce one blueprint.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("blueprint:plain"),
					rules: [],
				},
				{
					id: "line:producer:capped-blueprint",
					title: "Produce capped blueprint",
					description: "Produce one capped purpose-bound blueprint.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("blueprint:capped"),
					rules: [],
				},
				{
					id: "line:producer:ordinary-material",
					title: "Produce ordinary material",
					description: "Produce one ordinary material.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("item:target-unlimited"),
					rules: [],
				},
				{
					id: "line:producer:safe-blueprint",
					title: "Produce safe blueprint",
					description: "Produce one blueprint with a usable immediate line.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("blueprint:output"),
					rules: [],
				},
				{
					id: "line:producer:random-blueprint",
					title: "Produce random result",
					description: "May produce a capped dead-end blueprint.",
					runtimeMs: 200,
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
										type: "weight",
										quantity: {
											type: "value",
											value: 1,
										},
										drop: [
											{
												weight: 1,
												drop: [
													{
														itemId: "item:target-unlimited",
														quantity: {
															type: "value",
															value: 1,
														},
														placement: "drop",
														rules: [],
													},
												],
											},
											{
												weight: 1,
												drop: [
													{
														itemId: "blueprint:plain",
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
						],
					},
					rules: [],
				},
				{
					id: "line:producer:correlated-blueprint",
					title: "Produce correlated result",
					description: "Produces either one blueprint or its one capped result.",
					runtimeMs: 200,
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
										type: "weight",
										quantity: {
											type: "value",
											value: 1,
										},
										drop: [
											{
												weight: 1,
												drop: [
													{
														itemId: "blueprint:plain",
														quantity: {
															type: "value",
															value: 1,
														},
														placement: "drop",
														rules: [],
													},
												],
											},
											{
												weight: 1,
												drop: [
													{
														itemId: "item:target",
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
						],
					},
					rules: [],
				},
				{
					id: "line:producer:two-hop-cycle",
					title: "Produce bounded cycle",
					description: "Produces a blueprint whose next hop enters a bounded cycle.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("blueprint:hop-a"),
					rules: [],
				},
				{
					id: "line:producer:lifecycle-blueprint",
					title: "Produce lifecycle blueprint",
					description: "Produces a blueprint whose final charge has a capped branch.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("blueprint:depletion-random"),
					rules: [],
				},
			],
		},
		"producer:shared-source": {
			id: "producer:shared-source",
			type: "producer",
			title: "Shared source",
			description: "Produces the shared capped item.",
			asset: {
				source: [
					"asset:producer:shared-source",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				{
					id: "line:producer:shared-source",
					title: "Produce shared",
					description: "Produce one shared item.",
					runtimeMs: 200,
					input: [
						{
							type: "simple",
						},
					],
					output: blueprintOutput("item:shared"),
					rules: [],
				},
			],
		},
		"producer:shared-consumer": {
			id: "producer:shared-consumer",
			type: "producer",
			title: "Shared consumer",
			description: "Consumes the shared capped item without producing it.",
			asset: {
				source: [
					"asset:producer:shared-consumer",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				{
					id: "line:producer:shared-consumer",
					title: "Consume shared",
					description: "Consume one shared item.",
					runtimeMs: 200,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "item:shared",
							},
							quantity: {
								type: "value",
								value: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		"producer:recycler": {
			id: "producer:recycler",
			type: "producer",
			title: "Recycler",
			description: "Replaces one capped item with one capped item.",
			asset: {
				source: [
					"asset:producer:recycler",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				{
					id: "line:producer:recycler",
					title: "Recycle",
					description: "Consume and replace the same item.",
					runtimeMs: 200,
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "item:target",
							},
							quantity: {
								type: "value",
								value: 1,
							},
						},
					],
					output: blueprintOutput("item:target"),
					rules: [],
				},
			],
		},
		"producer:charged-stack": {
			id: "producer:charged-stack",
			type: "producer",
			title: "Charged stack",
			description: "Replaces exactly one depleted stacked owner.",
			asset: {
				source: [
					"asset:producer:charged-stack",
				],
			},
			tags: [],
			categoryId: "test",
			scope: "board",
			maxStackSize: 3,
			maxCount: 3,
			maxQueueSize: 1,
			charges: {
				amount: 1,
			},
			lines: [
				{
					id: "line:producer:charged-stack",
					title: "Renew one",
					description: "Spend the final owner charge and replace one owner.",
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
					output: blueprintOutput("producer:charged-stack"),
					rules: [],
				},
			],
		},
	},
});

const spawnBlueprintFx = Effect.fn("spawnBlueprintFx")(function* ({
	id,
	itemId,
	space,
	x,
	y,
}: {
	id: string;
	itemId:
		| "blueprint:capped"
		| "blueprint:depletion-capped"
		| "blueprint:depletion-random"
		| "blueprint:depletion-self"
		| "blueprint:depletion-self-no-output"
		| "blueprint:output"
		| "blueprint:plain"
		| "blueprint:range"
		| "blueprint:reserve";
	space: number;
	x: number;
	y: number;
}) {
	return yield* spawnItemFx({
		id,
		itemId,
		location: {
			scope: "board",
			space,
			position: {
				x,
				y,
			},
		},
		quantity: 1,
	});
});

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: blueprintConfig,
			}),
		) as Effect.Effect<A, E, never>,
	);

const sourceLine = (lineId: string) => {
	const source = blueprintConfig.items["producer:blueprint-source"];
	if (source?.type !== "producer") throw new Error("Missing blueprint source producer.");
	const line = source.lines.find((candidate) => candidate.id === lineId);
	if (line === undefined) throw new Error(`Missing source line ${lineId}.`);
	return line;
};

describe("blueprint job completion", () => {
	it("removes the depleted blueprint and places the first output at its freed cell", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:plain",
					x: 1,
					y: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:plain",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					owner,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		const target = result.runtime.items.find((item) => item.item.id === "item:target");
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.items.some((item) => item.id === result.owner.id)).toBe(false);
		expect(target).toMatchObject({
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 1,
				},
			},
			quantity: 1,
		});
		expect(target?.id).not.toBe(result.owner.id);
	});

	it("places target, by-products, and returned reservations in one completion", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:reserve",
					x: 0,
					y: 0,
				});
				const tool = yield* spawnItemFx({
					id: "runtime:tool",
					itemId: "item:tool",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:reserve",
					inputIndex: 0,
					sourceItemId: tool.id,
					sourceItemRevision: tool.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:reserve",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.map((item) => item.item.id)).toEqual(
			expect.arrayContaining([
				"item:target-unlimited",
				"item:byproduct",
				"item:tool",
			]),
		);
		expect(
			runtime.items.some(
				(item) => item.location.scope === "job" || item.location.scope === "reserved",
			),
		).toBe(false);
	});

	it("rolls back the target when a by-product cannot be placed", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:output",
					x: 0,
					y: 0,
				});
				for (const [index, position] of [
					{
						x: 1,
						y: 0,
					},
					{
						x: 2,
						y: 0,
					},
					{
						x: 0,
						y: 1,
					},
					{
						x: 1,
						y: 1,
					},
					{
						x: 2,
						y: 1,
					},
				].entries()) {
					yield* spawnItemFx({
						id: `runtime:byproduct-blocker:${index}`,
						itemId: "item:blocker",
						location: {
							scope: "board",
							space: 0,
							position,
						},
						quantity: 1,
					});
				}
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:output",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.some((item) => item.item.id === "blueprint:output")).toBe(true);
		expect(runtime.items.some((item) => item.item.id === "item:target-unlimited")).toBe(false);
		expect(runtime.items.some((item) => item.item.id === "item:byproduct")).toBe(false);
		expect(runtime.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 0,
			}),
		]);
	});

	it("rolls back target and by-products when the final reservation cannot return", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:reserve",
					x: 0,
					y: 0,
				});
				const tool = yield* spawnItemFx({
					id: "runtime:tool",
					itemId: "item:tool",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				for (const [index, position] of [
					{
						x: 2,
						y: 0,
					},
					{
						x: 0,
						y: 1,
					},
					{
						x: 1,
						y: 1,
					},
					{
						x: 2,
						y: 1,
					},
				].entries()) {
					yield* spawnItemFx({
						id: `runtime:blocker:${index}`,
						itemId: "item:blocker",
						location: {
							scope: "board",
							space: 0,
							position,
						},
						quantity: 1,
					});
				}
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:reserve",
					inputIndex: 0,
					sourceItemId: tool.id,
					sourceItemRevision: tool.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:reserve",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.some((item) => item.item.id === "blueprint:reserve")).toBe(true);
		expect(runtime.items.some((item) => item.item.id === "item:target-unlimited")).toBe(false);
		expect(runtime.items.some((item) => item.item.id === "item:byproduct")).toBe(false);
		expect(runtime.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 0,
			}),
		]);
		expect(runtime.items.some((item) => item.location.scope === "reserved")).toBe(true);
	});

	it("reserves a shared target maxCount across concurrent blueprint jobs", () => {
		const result = run(
			Effect.gen(function* () {
				const first = yield* spawnBlueprintFx({
					id: "runtime:first",
					space: 0,
					itemId: "blueprint:plain",
					x: 0,
					y: 0,
				});
				const second = yield* spawnBlueprintFx({
					id: "runtime:second",
					space: 0,
					itemId: "blueprint:plain",
					x: 1,
					y: 0,
				});
				yield* startLineFx({
					ownerItemId: first.id,
					lineId: "line:blueprint:plain",
				});
				const secondStart = yield* startLineFx({
					ownerItemId: second.id,
					lineId: "line:blueprint:plain",
				}).pipe(Effect.result);
				const placement = yield* placeDropFx({
					originItemId: second.id,
					drop: {
						itemId: "item:target",
						quantity: {
							type: "value",
							value: 1,
						},
						placement: "drop",
						rules: [],
					},
				}).pipe(Effect.result);
				const spawned = yield* spawnItemFx({
					id: "runtime:forbidden-target",
					itemId: "item:target",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				}).pipe(Effect.result);
				return {
					secondStart,
					placement,
					spawned,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(Result.isFailure(result.secondStart)).toBe(true);
		if (Result.isFailure(result.secondStart)) {
			expect(result.secondStart.failure).toMatchObject({
				_tag: "JobOutputMaxCountError",
				itemId: "item:target",
				maxCount: 1,
			});
		}
		expect(Result.isFailure(result.placement)).toBe(true);
		if (Result.isFailure(result.placement)) {
			expect(result.placement.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "item:max-count",
			});
		}
		expect(Result.isFailure(result.spawned)).toBe(true);
		if (Result.isFailure(result.spawned)) {
			expect(result.spawned.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "item:max-count",
			});
		}
		expect(result.runtime.jobs).toHaveLength(1);
	});

	it("prevents direct quantity mutation from consuming output capacity promised to a job", () => {
		const result = run(
			Effect.gen(function* () {
				const byproduct = yield* spawnItemFx({
					id: "runtime:byproduct",
					itemId: "item:byproduct",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				});
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:output",
					x: 0,
					y: 0,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:output",
				});
				const updated = yield* setItemQuantityFx({
					itemId: byproduct.id,
					quantity: 2,
					revision: byproduct.revision,
				}).pipe(Effect.result);
				return {
					updated,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(Result.isFailure(result.updated)).toBe(true);
		if (Result.isFailure(result.updated)) {
			expect(result.updated.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
				reason: "item:max-count",
			});
		}
		expect(result.runtime.items.find((item) => item.id === "runtime:byproduct")?.quantity).toBe(
			1,
		);
	});

	it("rejects enqueue when the active reservation already fills direct maxCount", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:producer",
					itemId: "producer:limited",
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
					lineId: "line:producer:limited",
				});
				const queued = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:limited",
				}).pipe(Effect.result);
				return {
					queued,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.queued).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "JobOutputMaxCountError",
					itemId: "item:queue-product",
				}),
			),
		);
		expect(result.runtime.jobs).toHaveLength(1);
		expect(result.runtime.jobQueue ?? []).toEqual([]);
	});

	it("does not let a consuming candidate cancel another active job reservation", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:shared-source",
					itemId: "producer:shared-source",
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
				const consumer = yield* spawnItemFx({
					id: "runtime:shared-consumer",
					itemId: "producer:shared-consumer",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				const shared = yield* spawnItemFx({
					id: "runtime:shared",
					itemId: "item:shared",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* storeInputMaterialFx({
					ownerItemId: consumer.id,
					lineId: "line:producer:shared-consumer",
					inputIndex: 0,
					sourceItemId: shared.id,
					sourceItemRevision: shared.revision,
					quantity: 1,
				});
				yield* startLineFx({
					ownerItemId: source.id,
					lineId: "line:producer:shared-source",
				});
				const runtime = yield* readRuntimeFx();
				const resolution = yield* resolveLineStartFx({
					ownerItemId: consumer.id,
					lineId: "line:producer:shared-consumer",
					runtime,
				});
				if (resolution.run.plan === undefined) {
					throw new Error("Expected exact consuming plan.");
				}
				const consumerDefinition = blueprintConfig.items["producer:shared-consumer"];
				if (consumerDefinition?.type !== "producer") {
					throw new Error("Missing shared consumer producer.");
				}
				const line = consumerDefinition.lines[0];
				return {
					candidate: yield* readPlannedLineNetMaximumOutputQuantitiesFx({
						line,
						plan: resolution.run.plan,
						runtime,
					}),
					reserved: yield* readReservedJobOutputQuantitiesFx({
						runtime,
					}),
				};
			}),
		);

		expect([
			...result.candidate,
		]).toEqual([]);
		expect(result.reserved.get("item:shared")?.quantity).toBe(1);
	});

	it("projects a direct cap above missing inputs and keeps read and command net semantics aligned", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:reserve",
					space: 0,
					itemId: "blueprint:reserve",
					x: 0,
					y: 0,
				});
				yield* spawnItemFx({
					id: "runtime:byproduct",
					itemId: "item:byproduct",
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
				return yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime: yield* readRuntimeFx(),
				});
			}),
		);

		expect(result).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "unavailable",
						reason: {
							kind: "direct-output-max-count",
							itemId: "item:byproduct",
						},
					},
					actions: {
						canStart: false,
					},
				},
			],
		});
	});

	it("keeps an input-starved net self-replacement available for preparation", () => {
		const result = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:target",
					itemId: "item:target",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				const owner = yield* spawnItemFx({
					id: "runtime:recycler",
					itemId: "producer:recycler",
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
				return yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime: yield* readRuntimeFx(),
				});
			}),
		);

		expect(result).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "available",
						readiness: "inputs",
					},
					actions: {
						canStart: false,
					},
				},
			],
		});
	});

	it("includes final-charge output and owner depletion in input-starved fallback", () => {
		const result = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:depletion-product",
					itemId: "item:depletion-product",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				});
				const capped = yield* spawnBlueprintFx({
					id: "runtime:depletion-capped",
					space: 0,
					itemId: "blueprint:depletion-capped",
					x: 0,
					y: 0,
				});
				const self = yield* spawnBlueprintFx({
					id: "runtime:depletion-self",
					space: 0,
					itemId: "blueprint:depletion-self",
					x: 1,
					y: 0,
				});
				const runtime = yield* readRuntimeFx();
				return {
					capped: yield* readItemDetailLinesFx({
						itemId: capped.id,
						runtime,
					}),
					self: yield* readItemDetailLinesFx({
						itemId: self.id,
						runtime,
					}),
				};
			}),
		);

		expect(result.capped).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "unavailable",
						reason: {
							kind: "direct-output-max-count",
							itemId: "item:depletion-product",
						},
					},
				},
			],
		});
		expect(result.self).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "available",
						readiness: "inputs",
					},
				},
			],
		});
	});

	it("keeps repeated random depletion reads pure and conservatively blocks every branch", () => {
		const result = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:depletion-product",
					itemId: "item:depletion-product",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				const owner = yield* spawnBlueprintFx({
					id: "runtime:depletion-random",
					space: 0,
					itemId: "blueprint:depletion-random",
					x: 0,
					y: 0,
				});
				const before = yield* readRuntimeFx();
				const first = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime: before,
				});
				const second = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime: before,
				});
				return {
					after: yield* readRuntimeFx(),
					before,
					first,
					second,
				};
			}),
		);

		expect(result.first).toEqual(result.second);
		expect(result.after).toEqual(result.before);
		expect(result.first).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "unavailable",
						reason: {
							kind: "direct-output-max-count",
							itemId: "item:depletion-product",
						},
					},
				},
			],
		});
	});

	it("subtracts exactly one depleted owner, including when no lifecycle output exists", () => {
		const result = run(
			Effect.gen(function* () {
				const noOutput = yield* spawnBlueprintFx({
					id: "runtime:depletion-self-no-output",
					space: 0,
					itemId: "blueprint:depletion-self-no-output",
					x: 0,
					y: 0,
				});
				const stack = yield* spawnItemFx({
					id: "runtime:charged-stack",
					itemId: "producer:charged-stack",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 3,
				});
				const runtime = yield* readRuntimeFx();
				const lines = yield* readItemDetailLinesFx({
					itemId: noOutput.id,
					runtime,
				});
				const stackLines = yield* readItemDetailLinesFx({
					itemId: stack.id,
					runtime,
				});
				const started = yield* startLineFx({
					ownerItemId: stack.id,
					lineId: "line:producer:charged-stack",
				}).pipe(Effect.result);
				return {
					lines,
					stackLines,
					started,
				};
			}),
		);

		expect(result.lines).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "available",
						readiness: "inputs",
					},
				},
			],
		});
		expect(result.stackLines).toMatchObject({
			kind: "available",
			line: [
				{
					availability: {
						kind: "available",
						readiness: "ready",
					},
				},
			],
		});
		expect(Result.isSuccess(result.started)).toBe(true);
	});

	it("blocks exactly one blueprint hop in both projection and command admission", () => {
		const result = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:target",
					itemId: "item:target",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				const owner = yield* spawnItemFx({
					id: "runtime:blueprint-source",
					itemId: "producer:blueprint-source",
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
				const before = yield* readRuntimeFx();
				const lines = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime: before,
				});
				const started = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:blueprint-source",
				}).pipe(Effect.result);
				return {
					after: yield* readRuntimeFx(),
					before,
					lines,
					started,
				};
			}),
		);

		expect(result.lines.kind).toBe("available");
		if (result.lines.kind !== "available") throw new Error("Expected available line list.");
		expect(
			result.lines.line.find((line) => line.lineId === "line:producer:blueprint-source"),
		).toMatchObject({
			availability: {
				kind: "unavailable",
				reason: {
					kind: "downstream-output-max-count",
					intermediateItemId: "blueprint:plain",
					itemId: "item:target",
				},
			},
		});
		expect(result.started).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "JobOutputMaxCountError",
					itemId: "item:target",
				}),
			),
		);
		expect(result.after).toEqual(result.before);
	});

	it("treats an existing blueprint as committed capacity for its capped target", () => {
		const result = run(
			Effect.gen(function* () {
				const blueprint = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					itemId: "blueprint:capped",
					space: 0,
					x: 1,
					y: 0,
				});
				const owner = yield* spawnItemFx({
					id: "runtime:blueprint-source",
					itemId: "producer:blueprint-source",
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
				const runtime = yield* readRuntimeFx();
				const lines = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime,
				});
				const sourceStarted = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:capped-blueprint",
				}).pipe(Effect.result);
				const blueprintStarted = yield* startLineFx({
					ownerItemId: blueprint.id,
					lineId: "line:blueprint:capped",
				}).pipe(Effect.result);
				return {
					blueprintStarted,
					lines,
					sourceStarted,
				};
			}),
		);

		expect(result.lines).toMatchObject({
			kind: "available",
			line: expect.arrayContaining([
				expect.objectContaining({
					lineId: "line:producer:capped-blueprint",
					availability: {
						kind: "unavailable",
						reason: {
							kind: "downstream-output-max-count",
							intermediateItemId: "blueprint:capped",
							itemId: "item:target",
							liveQuantity: 0,
							reservedQuantity: 2,
							maxCount: 1,
						},
					},
				}),
			]),
		});
		expect(result.sourceStarted).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "JobOutputMaxCountError",
					itemId: "item:target",
					reservedQuantity: 2,
				}),
			),
		);
		expect(Result.isSuccess(result.blueprintStarted)).toBe(true);
	});

	it("reserves a blueprint's capped target while the blueprint-producing job is pending", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:blueprint-source",
					itemId: "producer:blueprint-source",
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
				const firstStarted = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:blueprint-source",
				}).pipe(Effect.result);
				const runtime = yield* readRuntimeFx();
				const lines = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime,
				});
				const secondStarted = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:blueprint-source",
				}).pipe(Effect.result);
				return {
					firstStarted,
					lines,
					secondStarted,
				};
			}),
		);

		expect(Result.isSuccess(result.firstStarted)).toBe(true);
		expect(result.lines).toMatchObject({
			kind: "available",
			line: expect.arrayContaining([
				expect.objectContaining({
					lineId: "line:producer:blueprint-source",
					availability: {
						kind: "unavailable",
						reason: {
							kind: "downstream-output-max-count",
							intermediateItemId: "blueprint:plain",
							itemId: "item:target",
							liveQuantity: 0,
							reservedQuantity: 2,
							maxCount: 1,
						},
					},
				}),
			]),
		});
		expect(result.secondStarted).toEqual(
			Result.fail(
				expect.objectContaining({
					_tag: "JobOutputMaxCountError",
					itemId: "item:target",
					reservedQuantity: 2,
				}),
			),
		);
	});

	it("preserves weighted branch correlation across the one-hop reservation", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:blueprint-source",
					itemId: "producer:blueprint-source",
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
				const runtime = yield* readRuntimeFx();
				const resolved = yield* resolveOneHopLineOutputMaxCountFx({
					line: sourceLine("line:producer:correlated-blueprint"),
					runtime,
				});
				const started = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:producer:correlated-blueprint",
				}).pipe(Effect.result);
				return {
					resolved,
					started,
				};
			}),
		);

		expect(result.resolved).toBeUndefined();
		expect(Result.isSuccess(result.started)).toBe(true);
	});

	it("limits one-hop traversal to Blueprint children and exactly one edge", () => {
		const result = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:target",
					itemId: "item:target",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:depletion-product",
					itemId: "item:depletion-product",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				});
				const owner = yield* spawnItemFx({
					id: "runtime:blueprint-source",
					itemId: "producer:blueprint-source",
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
				const runtime = yield* readRuntimeFx();
				const ordinary = yield* resolveOneHopLineOutputMaxCountFx({
					line: sourceLine("line:producer:ordinary-material"),
					runtime,
				});
				const safe = yield* resolveOneHopLineOutputMaxCountFx({
					line: sourceLine("line:producer:safe-blueprint"),
					runtime,
				});
				const random = yield* resolveOneHopLineOutputMaxCountFx({
					line: sourceLine("line:producer:random-blueprint"),
					runtime,
				});
				const cycle = yield* resolveOneHopLineOutputMaxCountFx({
					line: sourceLine("line:producer:two-hop-cycle"),
					runtime,
				});
				const lifecycle = yield* resolveOneHopLineOutputMaxCountFx({
					line: sourceLine("line:producer:lifecycle-blueprint"),
					runtime,
				});
				const starts = {
					ordinary: yield* startLineFx({
						ownerItemId: owner.id,
						lineId: "line:producer:ordinary-material",
					}).pipe(Effect.result),
					cycle: yield* startLineFx({
						ownerItemId: owner.id,
						lineId: "line:producer:two-hop-cycle",
					}).pipe(Effect.result),
				};
				return {
					cycle,
					lifecycle,
					ordinary,
					random,
					safe,
					starts,
				};
			}),
		);

		expect(result.ordinary).toBeUndefined();
		expect(result.safe).toBeUndefined();
		expect(result.random).toMatchObject({
			intermediateItemId: "blueprint:plain",
			itemId: "item:target",
		});
		expect(result.cycle).toBeUndefined();
		expect(result.lifecycle).toMatchObject({
			intermediateItemId: "blueprint:depletion-random",
			itemId: "item:depletion-product",
		});
		expect(Result.isSuccess(result.starts.ordinary)).toBe(true);
		expect(Result.isSuccess(result.starts.cycle)).toBe(true);
	});

	it("rejects a job when any quantity in its random range can exceed maxCount", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:range",
					space: 0,
					itemId: "blueprint:range",
					x: 0,
					y: 0,
				});
				const started = yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:range",
				}).pipe(Effect.result);
				return {
					started,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(Result.isFailure(result.started)).toBe(true);
		if (Result.isFailure(result.started)) {
			expect(result.started.failure).toMatchObject({
				_tag: "JobOutputMaxCountError",
				itemId: "item:limited",
				reservedQuantity: 5,
				maxCount: 4,
			});
		}
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.items.some((item) => item.item.id === "blueprint:range")).toBe(true);
	});

	it("round-trips an active blueprint job through persisted state", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:plain",
					x: 0,
					y: 0,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:plain",
				});
				const runtime = yield* readRuntimeFx();
				const state = yield* fromRuntimeFx({
					runtime,
				});
				return {
					runtime,
					state,
					restored: yield* fromStateFx({
						state,
					}),
				};
			}),
		);

		expect(result.restored.jobs).toEqual(result.runtime.jobs);
		expect(result.restored.jobQueue).toEqual(result.runtime.jobQueue);
		expect(result.restored.items.map((item) => item.location)).toEqual(
			result.runtime.items.map((item) => item.location),
		);
		expect(result.state.jobs).toHaveLength(1);
	});

	it("discards queued work bound to the depleted blueprint identity", () => {
		const runtime = run(
			Effect.gen(function* () {
				const owner = yield* spawnBlueprintFx({
					id: "runtime:blueprint",
					space: 0,
					itemId: "blueprint:plain",
					x: 0,
					y: 0,
				});
				yield* startLineFx({
					ownerItemId: owner.id,
					lineId: "line:blueprint:plain",
				});
				const started = yield* readRuntimeFx();
				const job = started.jobs[0];
				return yield* completeJobRuntimeFx({
					jobId: job.id,
					runtime: {
						...started,
						jobs: [
							{
								...job,
								remainingMs: 0,
							},
						],
						jobQueue: [
							{
								id: "request:stale",
								ownerItemId: owner.id,
								lineId: "line:blueprint:plain",
							},
						],
					},
				});
			}),
		);

		expect(runtime.jobQueue).toEqual([]);
		expect(runtime.items.some((item) => item.id === "runtime:blueprint")).toBe(false);
	});
});
