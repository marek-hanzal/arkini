import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import { setDefaultLineFx } from "~/engine/line/write/setDefaultLineFx";
import { checkRuntimeFx } from "~/engine/runtime/check/checkRuntimeFx";
import { fromStateFx } from "~/engine/runtime/fx/fromStateFx";
import { removeRuntimeItemIdentityFx } from "~/engine/runtime/fx/removeRuntimeItemIdentityFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { fromRuntimeFx } from "~/engine/state/fx/fromRuntimeFx";
import { startFx } from "~/engine/start/write/startFx";

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

describe("setDefaultLineFx", () => {
	it("persists one exact default, projects it first, and makes the owner impure", () => {
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
					lineId: "line:second",
					isDefault: true,
				},
				{
					lineId: "line:first",
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
});
