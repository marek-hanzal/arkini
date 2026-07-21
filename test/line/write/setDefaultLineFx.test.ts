import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import { setDefaultLineFx } from "~/engine/line/write/setDefaultLineFx";
import { unsetDefaultLineFx } from "~/engine/line/write/unsetDefaultLineFx";
import { checkRuntimeFx } from "~/engine/runtime/check/checkRuntimeFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import { removeRuntimeItemIdentityFx } from "~/engine/runtime/fx/removeRuntimeItemIdentityFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import { startFx } from "~/engine/start/write/startFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";

const line = (id: string, title: string) => ({
	id,
	title,
	description: `${title} description.`,
	show: true,
	enable: true,
	runtimeMs: 1_000,
	input: [
		{
			type: "simple" as const,
		},
	],
	rules: [],
});

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:default-line",
		title: "Default line",
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
				itemId: "producer",
				space: 0,
				x: 0,
				y: 0,
			},
		],
	},
	categories: {},
	items: {
		producer: {
			id: "producer",
			type: "producer",
			title: "Producer",
			description: "Owns two lines.",
			asset: {
				source: [
					"asset:producer",
				],
			},
			tags: [],
			categoryId: "building",
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				line("line:first", "First"),
				line("line:second", "Second"),
			],
		},
	},
});
const createStackConfig = ({ boardWidth }: { readonly boardWidth: number }) =>
	GameConfigSchema.parse({
		version: "1.0",
		resources: {
			hero: "hero",
		},
		meta: {
			id: `game:default-line-stack:${boardWidth}`,
			title: "Default line stack",
			board: {
				width: boardWidth,
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
			producer: {
				id: "producer",
				type: "producer",
				title: "Producer",
				description: "Owns one line.",
				asset: {
					source: [
						"asset:producer",
					],
				},
				tags: [],
				categoryId: "building",
				scope: "any",
				maxStackSize: 3,
				maxQueueSize: 1,
				lines: [
					line("line:only", "Only"),
				],
			},
			blocker: {
				id: "blocker",
				type: "simple",
				title: "Blocker",
				description: "Blocks placement.",
				asset: {
					source: [
						"asset:blocker",
					],
				},
				tags: [],
				categoryId: "resource",
				scope: "any",
				maxStackSize: 1,
			},
		},
	});


describe("setDefaultLineFx", () => {
	it("persists one exact default without reordering authored lines and makes the owner impure", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const started = yield* startFx();
				const owner = started.items[0];
				if (owner === undefined) throw new Error("Missing producer.");
				yield* setDefaultLineFx({
					ownerItemId: owner.id,
					lineId: "line:second",
				});
				const runtime = yield* readRuntimeFx();
				const projection = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime,
				});
				const pure = yield* isItemPureFx({
					item: runtime.items[0]!,
					runtime,
				});
				const state = yield* fromRuntimeFx({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});
				return {
					owner,
					projection,
					pure,
					runtime,
					state,
					restored,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.runtime.defaultLineByOwnerItemId).toEqual({
			[result.owner.id]: "line:second",
		});
		expect(result.state.defaultLineByOwnerItemId).toEqual(
			result.runtime.defaultLineByOwnerItemId,
		);
		expect(result.restored.defaultLineByOwnerItemId).toEqual(
			result.runtime.defaultLineByOwnerItemId,
		);
		expect(result.pure).toBe(false);
		expect(result.projection).toMatchObject({
			kind: "available",
			line: [
				{
					lineId: "line:first",
					isDefault: false,
				},
				{
					lineId: "line:second",
					isDefault: true,
				},
			],
		});
	});

	it("unsets the exact default and restores owner purity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const started = yield* startFx();
				const owner = started.items[0];
				if (owner === undefined) throw new Error("Missing producer.");
				yield* setDefaultLineFx({
					ownerItemId: owner.id,
					lineId: "line:second",
				});
				yield* unsetDefaultLineFx({
					ownerItemId: owner.id,
				});
				const runtime = yield* readRuntimeFx();
				const projection = yield* readItemDetailLinesFx({
					itemId: owner.id,
					runtime,
				});
				const pure = yield* isItemPureFx({
					item: runtime.items[0]!,
					runtime,
				});
				return {
					projection,
					pure,
					runtime,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.runtime.defaultLineByOwnerItemId).toBeUndefined();
		expect(result.pure).toBe(true);
		expect(result.projection).toMatchObject({
			kind: "available",
			line: [
				{
					lineId: "line:first",
					isDefault: false,
				},
				{
					lineId: "line:second",
					isDefault: false,
				},
			],
		});
	});

	it("rejects foreign lines and reports stale persisted selections", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* startFx();
				const owner = runtime.items[0];
				if (owner === undefined) throw new Error("Missing producer.");
				const rejected = yield* Effect.either(
					setDefaultLineFx({
						ownerItemId: owner.id,
						lineId: "line:missing",
					}),
				);
				const checked = yield* checkRuntimeFx({
					runtime: {
						...runtime,
						defaultLineByOwnerItemId: {
							[owner.id]: "line:missing",
							"runtime:missing": "line:first",
						},
					},
				});
				return {
					checked,
					rejected,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Either.isLeft(result.rejected)).toBe(true);
		if (Either.isLeft(result.rejected)) {
			expect(result.rejected.left).toMatchObject({
				_tag: "LineNotFoundError",
				lineId: "line:missing",
			});
		}
		expect(result.checked.issues).toContainEqual({
			type: "line:default",
			ownerItemId: expect.any(String),
			lineId: "line:missing",
			reason: "line-missing",
		});
		expect(result.checked.issues).toContainEqual({
			type: "line:default",
			ownerItemId: "runtime:missing",
			lineId: "line:first",
			reason: "owner-missing",
		});
	});

	it("removes the selection with the exact owner identity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const started = yield* startFx();
				const owner = started.items[0];
				if (owner === undefined) throw new Error("Missing producer.");
				const selected = {
					...started,
					defaultLineByOwnerItemId: {
						[owner.id]: "line:first",
					},
				};
				return yield* removeRuntimeItemIdentityFx({
					item: owner,
					runtime: selected,
				});
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.items).toEqual([]);
		expect(result.defaultLineByOwnerItemId).toBeUndefined();
	});
	it("atomically isolates one exact stacked owner before selecting its default", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:producer",
					itemId: "producer",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 3,
				});
				yield* setDefaultLineFx({
					ownerItemId: owner.id,
					lineId: "line:only",
				});
				const runtime = yield* readRuntimeFx();
				const isolated = runtime.items.find((item) => item.id === owner.id);
				const remainder = runtime.items.find(
					(item) => item.item.id === "producer" && item.id !== owner.id,
				);
				if (isolated === undefined || remainder === undefined) {
					throw new Error("Expected isolated default owner and pure remainder.");
				}
				const selectedPure = yield* isItemPureFx({
					item: isolated,
					runtime,
				});
				const remainderPure = yield* isItemPureFx({
					item: remainder,
					runtime,
				});
				yield* unsetDefaultLineFx({
					ownerItemId: owner.id,
				});
				const clearedRuntime = yield* readRuntimeFx();
				const clearedOwner = clearedRuntime.items.find((item) => item.id === owner.id);
				if (clearedOwner === undefined) throw new Error("Expected cleared owner.");
				const clearedPure = yield* isItemPureFx({
					item: clearedOwner,
					runtime: clearedRuntime,
				});

				return {
					clearedPure,
					isolated,
					remainder,
					remainderPure,
					runtime,
					selectedPure,
				};
			}).pipe(
				useGameFx({
					config: createStackConfig({
						boardWidth: 2,
					}),
				}),
			),
		);

		expect(result.runtime.defaultLineByOwnerItemId).toEqual({
			"runtime:producer": "line:only",
		});
		expect(result.isolated).toMatchObject({
			id: "runtime:producer",
			quantity: 1,
		});
		expect(result.remainder).toMatchObject({
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
		expect(result.selectedPure).toBe(false);
		expect(result.remainderPure).toBe(true);
		expect(result.clearedPure).toBe(true);
	});

	it("rolls back the default mapping and split when the remainder cannot be placed", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:producer",
					itemId: "producer",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 2,
				});
				yield* spawnItemFx({
					id: "runtime:blocker",
					itemId: "blocker",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const selected = yield* Effect.either(
					setDefaultLineFx({
						ownerItemId: "runtime:producer",
						lineId: "line:only",
					}),
				);

				return {
					after: yield* readRuntimeFx(),
					before,
					selected,
				};
			}).pipe(
				useGameFx({
					config: createStackConfig({
						boardWidth: 1,
					}),
				}),
			),
		);

		expect(Either.isLeft(result.selected)).toBe(true);
		if (Either.isLeft(result.selected)) {
			expect(result.selected.left).toMatchObject({
				_tag: "PlacementUnavailableError",
			});
		}
		expect(result.after).toEqual(result.before);
	});

});
