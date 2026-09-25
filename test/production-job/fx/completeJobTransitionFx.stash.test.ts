import { Effect, type Layer, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import type { GameLayerFx } from "~test/support/GameLayerFx";
import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { removeRuntimeItemForTestFx } from "~test/item-interaction/support/removeRuntimeItemForTestFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { completeJobRuntimeForTestFx } from "~test/production-job/support/completeJobRuntimeForTestFx";

const value = (value: number) => ({
	min: value,
	max: value,
});

const outcome = (
	drops: ReadonlyArray<{
		itemUid: string;
		type?: "chance" | "guaranteed";
	}>,
) => ({
	set: [
		{
			rules: [],
			roll: drops.map(({ itemUid, type = "guaranteed" }) =>
				type === "chance"
					? {
							type,
							chance: 1,
							outcome: [
								{
									type: "item" as const,
									itemUid,
									quantity: value(1),
									placement: "drop" as const,
									rules: [],
								},
							],
						}
					: {
							type,
							outcome: [
								{
									type: "item" as const,
									itemUid,
									quantity: value(1),
									placement: "drop" as const,
									rules: [],
								},
							],
						},
			),
		},
	],
});

const simpleItem = (id: string) => ({
	maxQueueSize: 1,
	lines: [],

	uid: id,

	title: id,
	description: id,
	ui: "simple" as const,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},
});

const stashItem = ({
	id,
	lineUid,
	lineOutcome,
}: {
	id: string;
	lineUid: string;
	lineOutcome: ReturnType<typeof outcome>;
}) => ({
	maxQueueSize: 1,

	uid: id,

	units: {
		amount: 1,
	},
	title: id,
	description: id,
	ui: "default" as const,
	artwork: {
		scale: 0.8,
		default: [
			`artwork:${id}`,
		],
	},

	lines: [
		{
			uid: lineUid,
			title: lineUid,
			description: lineUid,
			runtimeMs: 200,
			input: [
				{
					type: "materials" as const,
					units: {
						from: "self" as const,
						cost: 1,
					},
					query: {
						distance: "far" as const,
						selector: {
							type: "item" as const,
							itemUid: "item:key",
						},
					},
					quantity: value(1),
				},
			],
			outcome: lineOutcome,
			rules: [],
		},
	],
});

const stashConfig = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:stash-completion",
		title: "Stash completion",
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
		"stash:guaranteed": stashItem({
			id: "stash:guaranteed",
			lineUid: "line:stash:guaranteed",
			lineOutcome: outcome([
				{
					itemUid: "item:coin",
				},
			]),
		}),
		"stash:chance": stashItem({
			id: "stash:chance",
			lineUid: "line:stash:chance",
			lineOutcome: outcome([
				{
					itemUid: "item:gem",
					type: "chance",
				},
			]),
		}),
		"stash:blocked": stashItem({
			id: "stash:blocked",
			lineUid: "line:stash:blocked",
			lineOutcome: outcome([
				{
					itemUid: "item:board-a",
				},
				{
					itemUid: "item:board-b",
				},
			]),
		}),
		"item:key": simpleItem("item:key"),
		"item:coin": simpleItem("item:coin"),
		"item:gem": simpleItem("item:gem"),
		"item:board-a": simpleItem("item:board-a"),
		"item:board-b": simpleItem("item:board-b"),
		"item:blocker": simpleItem("item:blocker"),
	},
});

const run = <A, E>(effect: Effect.Effect<A, E, Layer.Success<ReturnType<typeof GameLayerFx>>>) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: stashConfig,
			}),
		),
	);

const startStashFx = Effect.fn("startStashFx")(function* ({
	itemUid,
	lineUid,
}: {
	itemUid: "stash:blocked" | "stash:chance" | "stash:guaranteed";
	lineUid: string;
}) {
	const owner = yield* spawnItemFx({
		id: "runtime:stash",
		itemUid,
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 0,
				y: 0,
			},
		},
	});
	const key = yield* spawnItemFx({
		id: "runtime:key",
		itemUid: "item:key",
		location: {
			scope: "board",
			space: 0,
			position: {
				x: 1,
				y: 0,
			},
		},
	});
	yield* bufferInputMaterialForTestFx({
		ownerItemId: owner.id,
		lineUid,
		inputIndex: 0,
		sourceItemId: key.id,
		sourceItemRevision: key.revision,
	});
	const started = yield* startLineFx({
		ownerItemId: owner.id,
		lineUid,
	});
	if (started.type !== "started") {
		return yield* Effect.die(new Error(`Expected ${lineUid} to start immediately.`));
	}

	return {
		job: started.job,
		owner,
	};
});

describe("stash line completion transition", () => {
	it("stores input, starts explicitly, emits guaranteed outcome, and removes the owner once", () => {
		const result = run(
			Effect.gen(function* () {
				const started = yield* startStashFx({
					itemUid: "stash:guaranteed",
					lineUid: "line:stash:guaranteed",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const runtime = yield* readRuntimeFx();
				const repeated = yield* Effect.result(
					completeJobRuntimeForTestFx({
						jobId: started.job.id,
						runtime,
					}),
				);
				return {
					repeated,
					runtime,
				};
			}),
		);

		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.items.some((item) => item.item.uid === "stash:guaranteed")).toBe(
			false,
		);
		expect(result.runtime.items.filter((item) => item.item.uid === "item:coin")).toHaveLength(
			1,
		);
		expect(Result.isFailure(result.repeated)).toBe(true);
		if (Result.isFailure(result.repeated)) {
			expect(result.repeated.failure).toMatchObject({
				_tag: "JobNotFoundError",
			});
		}
	});

	it("resolves chance outcome through the ordinary line outcome path", () => {
		const runtime = run(
			Effect.gen(function* () {
				yield* startStashFx({
					itemUid: "stash:chance",
					lineUid: "line:stash:chance",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.filter((item) => item.item.uid === "item:gem")).toHaveLength(1);
		expect(runtime.items.some((item) => item.item.uid === "stash:chance")).toBe(false);
	});

	it("rolls back owner removal and partial outcome when the full outcome cannot be placed", () => {
		const result = run(
			Effect.gen(function* () {
				const started = yield* startStashFx({
					itemUid: "stash:blocked",
					lineUid: "line:stash:blocked",
				});
				const blocker = yield* spawnItemFx({
					id: "runtime:blocker",
					itemUid: "item:blocker",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const blocked = yield* readRuntimeFx();
				yield* removeRuntimeItemForTestFx({
					itemId: blocker.id,
					revision: blocker.revision,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return {
					blocked,
					completed: yield* readRuntimeFx(),
					jobId: started.job.id,
				};
			}),
		);

		expect(result.blocked.jobs).toEqual([
			expect.objectContaining({
				id: result.jobId,
				remainingMs: 0,
			}),
		]);
		expect(result.blocked.items.some((item) => item.item.uid === "stash:blocked")).toBe(true);
		expect(result.blocked.items.some((item) => item.item.uid === "item:board-a")).toBe(false);
		expect(result.blocked.items.some((item) => item.item.uid === "item:board-b")).toBe(false);
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.items.some((item) => item.item.uid === "stash:blocked")).toBe(
			false,
		);
		expect(result.completed.items.some((item) => item.item.uid === "item:board-a")).toBe(true);
		expect(result.completed.items.some((item) => item.item.uid === "item:board-b")).toBe(true);
	});

	it("round-trips an active stash job before completing it", () => {
		const result = run(
			Effect.gen(function* () {
				yield* startStashFx({
					itemUid: "stash:guaranteed",
					lineUid: "line:stash:guaranteed",
				});
				const runtime = yield* readRuntimeFx();
				const state = fromRuntimeFn({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});
				return {
					restored,
					runtime,
				};
			}),
		);

		expect(result.restored.jobs).toEqual(result.runtime.jobs);
		expect(result.restored.jobQueue).toEqual(result.runtime.jobQueue);
		expect(result.restored.items.map((item) => item.location)).toEqual(
			result.runtime.items.map((item) => item.location),
		);
	});
});
