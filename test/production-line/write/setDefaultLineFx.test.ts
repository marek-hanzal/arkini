import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { readItemDetailLinesFx } from "~/item-line-detail/fx/readItemDetailLinesFx";
import { isItemPureFn } from "~/game-runtime/fn/isItemPureFn";
import { setDefaultLineFx } from "~/production-line/write/setDefaultLineFx";
import { unsetDefaultLineFx } from "~/production-line/write/unsetDefaultLineFx";
import { checkRuntimeFx } from "~/game-runtime/fx/checkRuntimeFx";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { startFx } from "~/game-start/fx/startFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { DefaultLineIssueReasonEnumSchema } from "~/production-line/schema/check/DefaultLineIssueReasonEnumSchema";

const line = (id: string, title: string, isDefault = false) => ({
	id,
	title,
	description: `${title} description.`,
	default: isDefault,
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
	items: {
		producer: {
			uid: "producer",
			id: "producer",
			type: "producer",
			title: "Producer",
			description: "Owns two lines.",
			asset: {
				default: [
					"asset:producer",
				],
			},
			scope: "board",
			maxStackSize: 1,
			maxQueueSize: 1,
			lines: [
				line("line:first", "First", true),
				line("line:second", "Second"),
			],
		},
	},
});
const createStackConfig = ({ boardWidth }: { readonly boardWidth: number }) =>
	GameConfigSchema.parse({
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
		items: {
			producer: {
				uid: "producer",
				id: "producer",
				type: "producer",
				title: "Producer",
				description: "Owns one line.",
				asset: {
					default: [
						"asset:producer",
					],
				},
				scope: "any",
				maxStackSize: 3,
				maxQueueSize: 1,
				lines: [
					line("line:only", "Only", true),
				],
			},
			blocker: {
				uid: "blocker",
				id: "blocker",
				type: "simple",
				title: "Blocker",
				description: "Blocks placement.",
				asset: {
					default: [
						"asset:blocker",
					],
				},
				scope: "any",
				maxStackSize: 1,
			},
		},
	});

describe("setDefaultLineFx", () => {
	it("reads the authored fallback without creating runtime state", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* startFx();
				const owner = runtime.items[0];
				if (owner === undefined) throw new Error("Missing producer.");
				return {
					projection: yield* readItemDetailLinesFx({
						itemId: owner.id,
						runtime,
					}),
					pure: isItemPureFn({
						item: owner,
						runtime,
					}),
					runtime,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.runtime.defaultLineByOwnerItemId).toEqual({});
		expect(result.pure).toBe(true);
		expect(result.projection).toMatchObject({
			kind: "available",
			line: [
				{
					lineId: "line:first",
					isDefault: true,
				},
				{
					lineId: "line:second",
					isDefault: false,
				},
			],
		});
	});

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
				const pure = isItemPureFn({
					item: runtime.items[0]!,
					runtime,
				});
				const state = fromRuntimeFn({
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

	it("persists an explicit no-default override instead of restoring the authored fallback", () => {
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
				const pure = isItemPureFn({
					item: runtime.items[0]!,
					runtime,
				});
				const state = fromRuntimeFn({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});
				return {
					projection,
					pure,
					restored,
					runtime,
					state,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.runtime.defaultLineByOwnerItemId).toEqual({
			[result.runtime.items[0]!.id]: null,
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
				const rejected = yield* Effect.result(
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

		expect(Result.isFailure(result.rejected)).toBe(true);
		if (Result.isFailure(result.rejected)) {
			expect(result.rejected.failure).toMatchObject({
				_tag: "LineNotFoundError",
				lineId: "line:missing",
			});
		}
		expect(result.checked.issues).toContainEqual({
			type: RuntimeCheckIssueEnumSchema.enum.DefaultLine,
			ownerItemId: expect.any(String),
			lineId: "line:missing",
			reason: DefaultLineIssueReasonEnumSchema.enum.LineMissing,
		});
		expect(result.checked.issues).toContainEqual({
			type: RuntimeCheckIssueEnumSchema.enum.DefaultLine,
			ownerItemId: "runtime:missing",
			lineId: "line:first",
			reason: DefaultLineIssueReasonEnumSchema.enum.OwnerMissing,
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
		expect(result.defaultLineByOwnerItemId).toEqual({});
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
				const selectedPure = isItemPureFn({
					item: isolated,
					runtime,
				});
				const remainderPure = isItemPureFn({
					item: remainder,
					runtime,
				});
				yield* unsetDefaultLineFx({
					ownerItemId: owner.id,
				});
				const clearedRuntime = yield* readRuntimeFx();
				const clearedOwner = clearedRuntime.items.find((item) => item.id === owner.id);
				if (clearedOwner === undefined) throw new Error("Expected cleared owner.");
				const clearedPure = isItemPureFn({
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
		expect(result.clearedPure).toBe(false);
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
				const selected = yield* Effect.result(
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

		expect(Result.isFailure(result.selected)).toBe(true);
		if (Result.isFailure(result.selected)) {
			expect(result.selected.failure).toMatchObject({
				_tag: "PlacementUnavailableError",
			});
		}
		expect(result.after).toEqual(result.before);
	});
});
