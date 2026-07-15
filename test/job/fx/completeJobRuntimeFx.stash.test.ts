import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/v1/input/write/storeInputMaterialFx";
import { completeJobRuntimeFx } from "~/v1/job/fx/completeJobRuntimeFx";
import { startLineFx } from "~/v1/job/write/startLineFx";
import { fromStateFx } from "~/v1/runtime/fx/fromStateFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { removeItemFx } from "~/v1/runtime/write/removeItemFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { fromRuntimeFx } from "~/v1/state/fx/fromRuntimeFx";
import { runTickRuntimeByFx } from "~/v1/tick/fx/runTickRuntimeByFx";

const value = (value: number) => ({
	type: "value" as const,
	value,
});

const output = (
	drops: ReadonlyArray<{
		itemId: string;
		type?: "chance" | "guaranteed";
	}>,
) => ({
	set: [
		{
			roll: drops.map(({ itemId, type = "guaranteed" }) =>
				type === "chance"
					? {
							type,
							chance: 1,
							drop: [
								{
									itemId,
									quantity: value(1),
									placement: "drop" as const,
									rules: [],
								},
							],
						}
					: {
							type,
							drop: [
								{
									itemId,
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

const simpleItem = (id: string, scope: "any" | "board" = "any") => ({
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
	maxStackSize: 1,
});

const stashItem = ({
	id,
	lineId,
	lineOutput,
}: {
	id: string;
	lineId: string;
	lineOutput: ReturnType<typeof output>;
}) => ({
	id,
	type: "stash" as const,
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
		input: [
			{
				type: "materials" as const,
				charges: {
					from: "self" as const,
					cost: 1,
				},
				selector: {
					type: "item" as const,
					itemId: "item:key",
				},
				quantity: value(1),
			},
		],
		output: lineOutput,
		rules: [],
	},
});

const stashConfig = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:stash-completion",
		title: "Stash completion",
		board: {
			width: 2,
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
		"stash:guaranteed": stashItem({
			id: "stash:guaranteed",
			lineId: "line:stash:guaranteed",
			lineOutput: output([
				{
					itemId: "item:coin",
				},
			]),
		}),
		"stash:chance": stashItem({
			id: "stash:chance",
			lineId: "line:stash:chance",
			lineOutput: output([
				{
					itemId: "item:gem",
					type: "chance",
				},
			]),
		}),
		"stash:blocked": stashItem({
			id: "stash:blocked",
			lineId: "line:stash:blocked",
			lineOutput: output([
				{
					itemId: "item:board-a",
				},
				{
					itemId: "item:board-b",
				},
			]),
		}),
		"item:key": simpleItem("item:key"),
		"item:coin": simpleItem("item:coin"),
		"item:gem": simpleItem("item:gem"),
		"item:board-a": simpleItem("item:board-a", "board"),
		"item:board-b": simpleItem("item:board-b", "board"),
		"item:blocker": simpleItem("item:blocker"),
	},
});

const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config: stashConfig,
			}),
		) as Effect.Effect<A, E, never>,
	);

const startStashFx = Effect.fn("startStashFx")(function* ({
	itemId,
	lineId,
}: {
	itemId: "stash:blocked" | "stash:chance" | "stash:guaranteed";
	lineId: string;
}) {
	const owner = yield* spawnItemFx({
		id: "runtime:stash",
		itemId,
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
	const key = yield* spawnItemFx({
		id: "runtime:key",
		itemId: "item:key",
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
		lineId,
		inputIndex: 0,
		sourceItemId: key.id,
		sourceItemRevision: key.revision,
		quantity: 1,
	});
	const started = yield* startLineFx({
		ownerItemId: owner.id,
		lineId,
	});
	if (started.type !== "started") {
		return yield* Effect.dieMessage(`Expected ${lineId} to start immediately.`);
	}

	return {
		job: started.job,
		owner,
	};
});

describe("stash line completion", () => {
	it("stores input, starts explicitly, emits guaranteed output, and removes the owner once", () => {
		const result = run(
			Effect.gen(function* () {
				const started = yield* startStashFx({
					itemId: "stash:guaranteed",
					lineId: "line:stash:guaranteed",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const runtime = yield* readRuntimeFx();
				const repeated = yield* Effect.either(
					completeJobRuntimeFx({
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
		expect(result.runtime.items.some((item) => item.item.id === "stash:guaranteed")).toBe(
			false,
		);
		expect(result.runtime.items.filter((item) => item.item.id === "item:coin")).toHaveLength(1);
		expect(Either.isLeft(result.repeated)).toBe(true);
		if (Either.isLeft(result.repeated)) {
			expect(result.repeated.left).toMatchObject({
				_tag: "JobNotFoundError",
			});
		}
	});

	it("resolves chance output through the ordinary line output path", () => {
		const runtime = run(
			Effect.gen(function* () {
				yield* startStashFx({
					itemId: "stash:chance",
					lineId: "line:stash:chance",
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				return yield* readRuntimeFx();
			}),
		);

		expect(runtime.items.filter((item) => item.item.id === "item:gem")).toHaveLength(1);
		expect(runtime.items.some((item) => item.item.id === "stash:chance")).toBe(false);
	});

	it("rolls back owner removal and partial output when the full output cannot be placed", () => {
		const result = run(
			Effect.gen(function* () {
				const started = yield* startStashFx({
					itemId: "stash:blocked",
					lineId: "line:stash:blocked",
				});
				const blocker = yield* spawnItemFx({
					id: "runtime:blocker",
					itemId: "item:blocker",
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
				yield* runTickRuntimeByFx({
					elapsedMs: 200,
				});
				const blocked = yield* readRuntimeFx();
				yield* removeItemFx({
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
		expect(result.blocked.items.some((item) => item.item.id === "stash:blocked")).toBe(true);
		expect(result.blocked.items.some((item) => item.item.id === "item:board-a")).toBe(false);
		expect(result.blocked.items.some((item) => item.item.id === "item:board-b")).toBe(false);
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.items.some((item) => item.item.id === "stash:blocked")).toBe(false);
		expect(result.completed.items.some((item) => item.item.id === "item:board-a")).toBe(true);
		expect(result.completed.items.some((item) => item.item.id === "item:board-b")).toBe(true);
	});

	it("round-trips an active stash job before completing it", () => {
		const result = run(
			Effect.gen(function* () {
				yield* startStashFx({
					itemId: "stash:guaranteed",
					lineId: "line:stash:guaranteed",
				});
				const runtime = yield* readRuntimeFx();
				const state = yield* fromRuntimeFx({
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
