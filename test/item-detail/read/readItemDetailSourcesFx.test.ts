import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";

const fullLinesProjection = vi.hoisted(() => vi.fn());

vi.mock("~/engine/item-detail/read/readItemDetailLinesFx", () => ({
	readItemDetailLinesFx: fullLinesProjection,
}));

const item = (id: string) => ({
	uid: id,
	id,
	type: "simple" as const,
	title: id,
	description: id,
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	scope: "any" as const,
	maxStackSize: 10,
});

const line = ({
	id,
	show = true,
	showWhen,
	target = true,
}: {
	readonly id: string;
	readonly show?: boolean;
	readonly showWhen?: string;
	readonly target?: boolean;
}) => ({
	id,
	title: id,
	description: id,
	show,
	enable: false,
	runtimeMs: 1_000,
	input: [
		{
			type: "simple" as const,
		},
	],
	output: {
		set: target
			? [
					{
						weight: 3,
						roll: [
							{
								type: "guaranteed" as const,
								drop: [
									{
										itemId: "target",
										quantity: {
											min: 2,
											max: 2,
										},
										rules: [],
									},
								],
							},
							{
								type: "chance" as const,
								chance: 0.65,
								drop: [
									{
										itemId: "target",
										quantity: {
											min: 1,
											max: 4,
										},
										rules: [],
									},
								],
							},
						],
					},
					{
						weight: 1,
						roll: [
							{
								type: "guaranteed" as const,
								drop: [
									{
										itemId: "byproduct",
										quantity: {
											min: 1,
											max: 1,
										},
										rules: [],
									},
								],
							},
						],
					},
				]
			: [
					{
						roll: [
							{
								type: "guaranteed" as const,
								drop: [
									{
										itemId: "byproduct",
										quantity: {
											min: 1,
											max: 1,
										},
										rules: [],
									},
								],
							},
						],
					},
				],
	},
	rules:
		showWhen === undefined
			? []
			: [
					{
						type: "show" as const,
						when: [
							{
								type: "exists" as const,
								query: {
									scope: "any" as const,
									selector: {
										type: "item" as const,
										itemId: showWhen,
									},
								},
							},
						],
					},
				],
});

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:sources",
		title: "Sources",
		board: {
			width: 5,
			height: 5,
		},
		inventory: {
			width: 5,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	items: {
		target: item("target"),
		byproduct: item("byproduct"),
		permit: item("permit"),
		alpha: {
			...item("alpha"),
			type: "producer",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				line({
					id: "line:hidden",
					show: false,
					showWhen: "permit",
				}),
				line({
					id: "line:alpha:first",
				}),
				line({
					id: "line:alpha:second",
				}),
			],
		},
		beta: {
			...item("beta"),
			type: "producer",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				line({
					id: "line:beta",
				}),
			],
		},
		irrelevant: {
			...item("irrelevant"),
			type: "producer",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				line({
					id: "line:irrelevant",
					target: false,
				}),
			],
		},
	},
});

const runtimeItem = ({
	definition,
	id,
	location,
}: {
	readonly definition: keyof typeof config.items;
	readonly id: string;
	readonly location: RuntimeItemSchema.Type["location"];
}): RuntimeItemSchema.Type => ({
	id,
	item: config.items[definition],
	location,
	quantity: 1,
	revision: `revision:${id}`,
});

const runtime = {
	cheats: {
		enabled: false,
		everEnabled: false,
		instantGameplay: false,
	},
	currentSpace: 2,
	items: [
		runtimeItem({
			definition: "target",
			id: "runtime:target",
			location: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
		}),
		runtimeItem({
			definition: "alpha",
			id: "runtime:alpha:space-0",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
		}),
		runtimeItem({
			definition: "beta",
			id: "runtime:beta:current",
			location: {
				scope: "board",
				space: 2,
				position: {
					x: 1,
					y: 0,
				},
			},
		}),
		runtimeItem({
			definition: "alpha",
			id: "runtime:alpha:space-3",
			location: {
				scope: "board",
				space: 3,
				position: {
					x: 2,
					y: 0,
				},
			},
		}),
		runtimeItem({
			definition: "alpha",
			id: "runtime:alpha:stored",
			location: {
				scope: "toolbar",
				position: {
					x: 0,
					y: 0,
				},
			},
		}),
		runtimeItem({
			definition: "irrelevant",
			id: "runtime:irrelevant",
			location: {
				scope: "board",
				space: 2,
				position: {
					x: 3,
					y: 0,
				},
			},
		}),
	],
	jobs: [],

	jobQueue: [],
	defaultLineByOwnerItemId: {},
} satisfies RuntimeSchema.Type;

const readSources = (props: readItemDetailSourcesFx.Props) =>
	Effect.runSync(
		readItemDetailSourcesFx(props).pipe(Effect.provideService(GameConfigFx, config)),
	);

describe("readItemDetailSourcesFx", () => {
	beforeEach(() => {
		fullLinesProjection.mockClear();
	});

	it("finds exact owned sources on and off the Board without filtering blocked lines", () => {
		const result = readSources({
			target: {
				kind: "runtime",
				itemId: "runtime:target",
			},
			runtime,
		});
		expect(result.kind).toBe("available");
		if (result.kind !== "available") throw new Error("Expected sources.");
		expect(result.source.map(({ ownerItemId }) => ownerItemId)).toEqual([
			"runtime:beta:current",
			"runtime:alpha:space-0",
			"runtime:alpha:space-3",
			"runtime:alpha:stored",
		]);
		expect(result.source[1]?.line.map(({ lineId }) => lineId)).toEqual([
			"line:alpha:first",
			"line:alpha:second",
		]);
		expect(result.source[1]?.line[0]?.output).toEqual([
			{
				kind: "guaranteed",
				quantity: {
					min: 2,
					max: 2,
				},
				setWeight: 3,
				totalSetWeight: 4,
			},
			{
				kind: "chance",
				chance: 0.65,
				quantity: {
					min: 1,
					max: 4,
				},
				setWeight: 3,
				totalSetWeight: 4,
			},
		]);
		expect(result.source[3]?.line.map(({ lineId }) => lineId)).toEqual([
			"line:hidden",
			"line:alpha:first",
			"line:alpha:second",
		]);
		expect(fullLinesProjection).not.toHaveBeenCalled();
	});

	it("resolves configured definition Sources without selecting an equal runtime target", () => {
		const result = readSources({
			target: {
				kind: "definition",
				itemId: "target",
			},
			runtime: {
				...runtime,
				items: runtime.items.filter((candidate) => candidate.item.id !== "target"),
			},
		});
		expect(result).toMatchObject({
			kind: "available",
			itemId: "target",
			targetDefinitionItemId: "target",
		});
		if (result.kind !== "available") throw new Error("Expected definition sources.");
		expect(result.source.map(({ ownerItemId }) => ownerItemId)).toEqual([
			"runtime:beta:current",
			"runtime:alpha:space-0",
			"runtime:alpha:space-3",
			"runtime:alpha:stored",
		]);
	});

	it("keeps multiple off-Board owners exact and deterministically ordered", () => {
		const target = runtime.items.find(({ id }) => id === "runtime:target");
		const storedOwner = runtime.items.find(({ id }) => id === "runtime:alpha:stored");
		if (target === undefined || storedOwner === undefined) {
			throw new Error("Missing off-Board source fixtures.");
		}
		const secondStoredOwner = runtimeItem({
			definition: "alpha",
			id: "runtime:alpha:inventory",
			location: {
				scope: "inventory",
				position: {
					x: 1,
					y: 0,
				},
			},
		});
		const result = readSources({
			target: {
				kind: "runtime",
				itemId: "runtime:target",
			},
			runtime: {
				...runtime,
				items: [
					target,
					secondStoredOwner,
					storedOwner,
				],
			},
		});
		if (result.kind !== "available") throw new Error("Expected off-Board sources.");

		expect(result.source.map(({ ownerItemId }) => ownerItemId)).toEqual([
			"runtime:alpha:inventory",
			"runtime:alpha:stored",
		]);
		expect(result.source.every(({ line }) => line.length === 3)).toBe(true);
	});

	it("does not reintroduce a hidden Board line as a generic owned source", () => {
		const alpha = config.items.alpha;
		if (alpha.type !== "producer") throw new Error("Expected Alpha producer fixture.");
		const hiddenLine = alpha.lines[0];
		const target = runtime.items.find(({ id }) => id === "runtime:target");
		if (hiddenLine === undefined || target === undefined) {
			throw new Error("Missing hidden source fixtures.");
		}
		const hiddenOwner = {
			...runtimeItem({
				definition: "alpha",
				id: "runtime:alpha:hidden-only",
				location: {
					scope: "board",
					space: 0,
					position: {
						x: 0,
						y: 0,
					},
				},
			}),
			item: {
				...alpha,
				lines: [
					hiddenLine,
				],
			},
		} satisfies RuntimeItemSchema.Type;
		const result = readSources({
			target: {
				kind: "runtime",
				itemId: "runtime:target",
			},
			runtime: {
				...runtime,
				items: [
					target,
					hiddenOwner,
				],
			},
		});
		if (result.kind !== "available") throw new Error("Expected source projection.");

		expect(result.source).toEqual([]);
	});

	it("omits configured one-hop sources that the player does not own", () => {
		const result = readSources({
			target: {
				kind: "definition",
				itemId: "target",
			},
			runtime: {
				...runtime,
				items: runtime.items.filter((candidate) => candidate.item.id === "target"),
			},
		});
		if (result.kind !== "available") throw new Error("Expected definition sources.");

		expect(result.source).toEqual([]);
	});

	it("finds an owned Well Blueprint outside the Board as a one-hop source of Well", async () => {
		const officialConfig = await readArkiniGameConfigSource();
		const ownedBlueprint = {
			id: "runtime:blueprint-well",
			item: officialConfig.items["item:blueprint-well-t1"],
			location: {
				scope: "inventory",
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 1,
			revision: "revision:blueprint-well",
		} satisfies RuntimeItemSchema.Type;
		const result = Effect.runSync(
			readItemDetailSourcesFx({
				target: {
					kind: "definition",
					itemId: "producer:well-t1",
				},
				runtime: {
					cheats: {
						enabled: false,
						everEnabled: false,
						instantGameplay: false,
					},
					currentSpace: 0,
					items: [
						ownedBlueprint,
					],
					jobs: [],

					jobQueue: [],
					defaultLineByOwnerItemId: {},
				},
			}).pipe(Effect.provideService(GameConfigFx, officialConfig)),
		);
		if (result.kind !== "available") throw new Error("Expected Well sources.");

		expect(result.source).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					ownerDefinitionItemId: "item:blueprint-well-t1",
				}),
			]),
		);
		expect(
			result.source.find(
				({ ownerDefinitionItemId }) => ownerDefinitionItemId === "item:blueprint-well-t1",
			)?.ownerItemId,
		).toBe(ownedBlueprint.id);
	});

	it("resolves an unowned Bakery through its blueprint to the owned Town Hall source", async () => {
		const officialConfig = await readArkiniGameConfigSource();
		const townHall = {
			id: "runtime:townhall-t3",
			item: officialConfig.items["producer:townhall-t3"],
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 1,
			revision: "revision:townhall-t3",
		} satisfies RuntimeItemSchema.Type;
		const result = Effect.runSync(
			readItemDetailSourcesFx({
				target: {
					kind: "definition",
					itemId: "producer:bakery-t1",
				},
				runtime: {
					cheats: {
						enabled: false,
						everEnabled: false,
						instantGameplay: false,
					},
					currentSpace: 0,
					items: [
						townHall,
					],
					jobs: [],

					jobQueue: [],
					defaultLineByOwnerItemId: {},
				},
			}).pipe(Effect.provideService(GameConfigFx, officialConfig)),
		);

		expect(result).toMatchObject({
			kind: "available",
			targetDefinitionItemId: "item:blueprint-bakery-t1",
			source: [
				{
					ownerItemId: townHall.id,
					ownerDefinitionItemId: "producer:townhall-t3",
					line: [
						{
							lineId: "line:townhall-t3:blueprint-bakery-t1",
						},
					],
				},
			],
		});
	});

	it("resolves an owned Farm through its blueprint to the owned Town Hall source", async () => {
		const officialConfig = await readArkiniGameConfigSource();
		const farm = {
			id: "runtime:farm-t1",
			item: officialConfig.items["producer:farm-t1"],
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 0,
				},
			},
			quantity: 1,
			revision: "revision:farm-t1",
		} satisfies RuntimeItemSchema.Type;
		const townHall = {
			id: "runtime:townhall-t2",
			item: officialConfig.items["producer:townhall-t2"],
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
			quantity: 1,
			revision: "revision:townhall-t2",
		} satisfies RuntimeItemSchema.Type;
		const result = Effect.runSync(
			readItemDetailSourcesFx({
				target: {
					kind: "runtime",
					itemId: farm.id,
				},
				runtime: {
					cheats: {
						enabled: false,
						everEnabled: false,
						instantGameplay: false,
					},
					currentSpace: 0,
					items: [
						farm,
						townHall,
					],
					jobs: [],

					jobQueue: [],
					defaultLineByOwnerItemId: {},
				},
			}).pipe(Effect.provideService(GameConfigFx, officialConfig)),
		);

		expect(result).toMatchObject({
			kind: "available",
			itemId: farm.id,
			targetDefinitionItemId: "item:blueprint-farm-t1",
			source: [
				{
					ownerItemId: townHall.id,
					ownerDefinitionItemId: "producer:townhall-t2",
					line: [
						{
							lineId: "line:townhall-t2:blueprint-farm-t1",
						},
					],
				},
			],
		});
	});

	it("returns unavailable for a missing configured definition target", () => {
		expect(
			readSources({
				target: {
					kind: "definition",
					itemId: "definition:missing",
				},
				runtime,
			}),
		).toEqual({
			kind: "unavailable",
		});
	});

	it("keeps an active hidden line visible without reading readiness or input plans", () => {
		const result = readSources({
			target: {
				kind: "runtime",
				itemId: "runtime:target",
			},
			runtime: {
				...runtime,
				jobs: [
					{
						id: "job:hidden",
						ownerItemId: "runtime:alpha:space-0",
						lineId: "line:hidden",
						durationMs: 1_000,
						remainingMs: 400,
					},
				],
			},
		});
		if (result.kind !== "available") throw new Error("Expected sources.");
		expect(result.source[1]?.line.map(({ lineId }) => lineId)).toEqual([
			"line:hidden",
			"line:alpha:first",
			"line:alpha:second",
		]);
		expect(fullLinesProjection).not.toHaveBeenCalled();
	});

	it("evaluates only canonical show/hide rules for matching output lines", () => {
		const result = readSources({
			target: {
				kind: "runtime",
				itemId: "runtime:target",
			},
			runtime: {
				...runtime,
				items: [
					...runtime.items,
					runtimeItem({
						definition: "permit",
						id: "runtime:permit",
						location: {
							scope: "inventory",
							position: {
								x: 1,
								y: 0,
							},
						},
					}),
				],
			},
		});
		if (result.kind !== "available") throw new Error("Expected sources.");
		expect(result.source[1]?.line.map(({ lineId }) => lineId)).toEqual([
			"line:hidden",
			"line:alpha:first",
			"line:alpha:second",
		]);
		expect(fullLinesProjection).not.toHaveBeenCalled();
	});

	it("scales across 500 Board owners without invoking the complete Lines projection", () => {
		const target = runtime.items.find((candidate) => candidate.id === "runtime:target");
		if (target === undefined) throw new Error("Missing target fixture.");
		const owners = Array.from(
			{
				length: 500,
			},
			(_, index) =>
				runtimeItem({
					definition: "alpha",
					id: `runtime:scale:${index.toString().padStart(3, "0")}`,
					location: {
						scope: "board",
						space: index % 4,
						position: {
							x: index,
							y: 0,
						},
					},
				}),
		);
		const result = readSources({
			target: {
				kind: "runtime",
				itemId: target.id,
			},
			runtime: {
				...runtime,
				items: [
					target,
					...owners,
				],
			},
		});
		if (result.kind !== "available") throw new Error("Expected scaled sources.");
		expect(result.source).toHaveLength(500);
		expect(result.source.every((source) => source.line.length === 2)).toBe(true);
		expect(fullLinesProjection).not.toHaveBeenCalled();
	});

	it("returns unavailable for a stale exact target", () => {
		expect(
			readSources({
				target: {
					kind: "runtime",
					itemId: "runtime:missing",
				},
				runtime,
			}),
		).toEqual({
			kind: "unavailable",
		});
	});
});
