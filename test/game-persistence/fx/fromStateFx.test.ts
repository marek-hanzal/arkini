import { readBoardSizeFn } from "~/game-runtime/fn/readBoardSizeFn";
import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:test",
		title: "Test game",
		board: {
			width: 3,
			height: 3,
		},
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		tree: {
			maxQueueSize: 1,
			lines: [],

			uid: "tree",
			title: "Tree",
			description: "A living tree.",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:tree",
				],
			},
		},
	},
});

const state = StateSchema.parse({
	cheats: {
		enabled: false,
		everEnabled: false,
		speedUpGameplay: false,
	},
	currentSpace: 0,
	templateUidBySpace: {},
	items: [
		{
			id: "runtime:board:tree",
			itemUid: "tree",
			location: {
				scope: "board",
				space: 0,
				position: {
					x: 1,
					y: 2,
				},
			},
		},
		{
			id: "runtime:second-tree",
			itemUid: "tree",
			location: {
				scope: "board" as const,
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
		},
	],

	jobs: [],
	jobQueue: [],
});

describe("fromStateFx", () => {
	it("round-trips gameplay state without persisting runtime revisions", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const firstRuntime = yield* fromStateFx({
					state,
				});
				const secondRuntime = yield* fromStateFx({
					state,
				});
				const dehydrated = fromRuntimeFn({
					runtime: firstRuntime,
				});

				return {
					dehydrated,
					firstRuntime,
					secondRuntime,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.dehydrated).toEqual(state);
		expect(result.firstRuntime.items.map((item) => item.revision)).not.toEqual(
			result.secondRuntime.items.map((item) => item.revision),
		);
		for (const item of result.firstRuntime.items) {
			expect(item.revision).toMatch(/^revision:/);
		}
	});

	it("fails when state references an unknown canonical item", () => {
		const invalidState = StateSchema.parse({
			cheats: {
				enabled: false,
				everEnabled: false,
				speedUpGameplay: false,
			},
			currentSpace: 0,
			templateUidBySpace: {},
			items: state.items.map((item) => {
				if (item.id !== "runtime:board:tree") {
					return item;
				}

				return {
					...item,
					itemUid: "missing",
				};
			}),
			jobQueue: [],
			jobs: [],
		});
		const result = Effect.runSync(
			Effect.result(
				fromStateFx({
					state: invalidState,
				}).pipe(
					useGameFx({
						config,
					}),
				),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "ItemNotFoundError",
				itemUid: "missing",
			});
		}
	});

	it("preserves existing positions outside current dimensions without blocking later transitions", () => {
		const invalidState = StateSchema.parse({
			...state,
			items: state.items.map((item) => {
				if (item.id !== "runtime:board:tree") {
					return item;
				}

				return {
					...item,
					location: {
						...item.location,
						position: {
							x: 3,
							y: 2,
						},
					},
				};
			}),
		});
		const hydrated = Effect.runSync(
			fromStateFx({
				state: invalidState,
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* modifyRuntimeFx((runtime) =>
					Effect.succeed([
						undefined,
						{
							...runtime,
							cheats: {
								...runtime.cheats,
								enabled: true,
							},
						},
					] as const),
				);
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config,
					state: fromRuntimeFn({
						runtime: hydrated,
					}),
				}),
			),
		);
		expect(result.items.map((item) => item.location)).toEqual(
			invalidState.items.map((item) => item.location),
		);
		expect(result.cheats.enabled).toBe(true);
	});
});

it("builds every runtime item with the original canonical game object", () => {
	const runtime = Effect.runSync(
		fromStateFx({
			state,
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	const canonicalTree = config.items.tree;
	const boardTree = runtime.items.find((item) => item.id === "runtime:board:tree");
	const secondTree = runtime.items.find((item) => item.id === "runtime:second-tree");

	expect(boardTree?.item).toBe(canonicalTree);
	expect(secondTree?.item).toBe(canonicalTree);
});

it("round-trips the active template identity independently of startup mappings and template contents", () => {
	const loadedConfig = GameConfigSchema.parse({
		...config,
		templates: [
			{
				uid: "start",
				title: "Start",
				width: 1,
				height: 1,
				board: [],
			},
			{
				uid: "active",
				title: "Active",
				width: 4,
				height: 5,
				board: [],
			},
		],
		start: {
			currentSpace: 0,
			spaces: [
				{
					space: 0,
					templateUid: "start",
				},
			],
		},
	});
	const saved = {
		...state,
		templateUidBySpace: {
			0: "active",
		},
	};
	const runtime = Effect.runSync(
		fromStateFx({
			state: saved,
		}).pipe(
			useGameFx({
				config: loadedConfig,
			}),
		),
	);
	expect(
		fromRuntimeFn({
			runtime,
		}),
	).toEqual(saved);
	expect(
		readBoardSizeFn({
			config: loadedConfig,
			runtime,
			space: 0,
		}),
	).toEqual({
		width: 4,
		height: 5,
	});
	expect(
		readBoardSizeFn({
			config: loadedConfig,
			runtime,
			space: 9,
		}),
	).toEqual(config.meta.board);
	expect(
		runtime.items.map(({ id, location }) => ({
			id,
			location,
		})),
	).toEqual(
		saved.items.map(({ id, location }) => ({
			id,
			location,
		})),
	);
});
