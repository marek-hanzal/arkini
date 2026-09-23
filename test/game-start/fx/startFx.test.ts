import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { planDropPlacementFx } from "~/item-placement/fx/planDropPlacementFx";
import { readBoardSizeFn } from "~/game-runtime/fn/readBoardSizeFn";
import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { startTestConfig } from "~test/game-start/support/startTestConfig";
import { startFx } from "~/game-start/fx/startFx";

describe("startFx", () => {
	it("reuses one template in distinct spaces with independent identities and dimensions", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			templates: [
				{
					uid: "logs",
					title: "Logs",
					width: 2,
					height: 1,
					board: [
						{
							itemId: "log",
							x: 0,
							y: 0,
						},
					],
				},
			],
			start: {
				currentSpace: 0,
				spaces: [
					{
						space: 0,
						templateUid: "logs",
					},
					{
						space: 1,
						templateUid: "logs",
					},
				],
			},
		});
		const runtime = Effect.runSync(
			startFx().pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(runtime.items).toHaveLength(2);
		expect(runtime.items.map((item) => item.location)).toEqual([
			{
				scope: "board",
				space: 0,
				position: {
					x: 0,
					y: 0,
				},
			},
			{
				scope: "board",
				space: 1,
				position: {
					x: 0,
					y: 0,
				},
			},
		]);
		expect(new Set(runtime.items.map((item) => item.id)).size).toBe(2);
	});

	it("rejects an already populated runtime without changing it", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:existing",
					itemId: "tree",
					location: {
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
						scope: "board",
					},
				});
				const before = yield* readRuntimeFx();
				const started = yield* Effect.result(startFx());
				const after = yield* readRuntimeFx();

				return {
					after,
					before,
					started,
				};
			}).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(Result.isFailure(result.started)).toBe(true);
		if (Result.isFailure(result.started)) {
			expect(result.started.failure).toMatchObject({
				_tag: "RuntimeNotEmptyError",
				itemCount: 1,
			});
		}
		expect(result.after).toBe(result.before);
	});

	it("rolls back the complete start when a template item cannot resolve", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			templates: [
				{
					uid: "missing",
					title: "Missing",
					width: 2,
					height: 1,
					board: [
						{
							itemId: "tree",
							x: 0,
							y: 0,
						},
						{
							itemId: "missing",
							x: 1,
							y: 0,
						},
					],
				},
			],
			start: {
				currentSpace: 0,
				spaces: [
					{
						space: 0,
						templateUid: "missing",
					},
				],
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const started = yield* Effect.result(startFx());
				const runtime = yield* readRuntimeFx();

				return {
					runtime,
					started,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Result.isFailure(result.started)).toBe(true);
		expect(result.runtime.items).toEqual([]);
	});

	it("serializes concurrent start attempts against one empty runtime", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const attempts = yield* Effect.all(
					[
						Effect.result(startFx()),
						Effect.result(startFx()),
					],
					{
						concurrency: "unbounded",
					},
				);
				const runtime = yield* readRuntimeFx();

				return {
					attempts,
					runtime,
				};
			}).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(result.attempts.filter(Result.isSuccess)).toHaveLength(1);
		expect(result.attempts.filter(Result.isFailure)).toHaveLength(1);
		expect(result.runtime.items).toHaveLength(1);
	});
});

it("hydrates saved items while the loaded template remains dimension authority", () => {
	const runtime = Effect.runSync(
		startFx().pipe(
			useGameFx({
				config: startTestConfig,
			}),
		),
	);
	const state = fromRuntimeFn({
		runtime,
	});
	const changedConfig = GameConfigSchema.parse({
		...startTestConfig,
		meta: {
			...startTestConfig.meta,
			board: {
				width: 1,
				height: 1,
			},
		},
		templates: [
			{
				uid: "start",
				title: "Changed",
				width: 5,
				height: 4,
				board: [],
			},
		],
	});
	const hydrated = Effect.runSync(
		fromStateFx({
			state,
		}).pipe(
			useGameFx({
				config: changedConfig,
			}),
		),
	);
	expect(
		readBoardSizeFn({
			runtime: hydrated,
			config: changedConfig,
			space: 0,
		}),
	).toEqual({
		width: 5,
		height: 4,
	});
	expect(
		hydrated.items.map(({ id, location }) => ({
			id,
			location,
		})),
	).toEqual(
		runtime.items.map(({ id, location }) => ({
			id,
			location,
		})),
	);
	expect(
		readBoardSizeFn({
			runtime: hydrated,
			config: changedConfig,
			space: 99,
		}),
	).toEqual({
		width: 1,
		height: 1,
	});
});

it("rejects drops that fit project defaults but exceed the destination space capacity", () => {
	const config = GameConfigSchema.parse({
		...startTestConfig,
		templates: [
			{
				uid: "tiny",
				title: "Tiny",
				width: 1,
				height: 1,
				board: [],
			},
		],
		start: {
			currentSpace: 0,
			spaces: [
				{
					space: 0,
					templateUid: "tiny",
				},
			],
		},
	});
	const result = Effect.runSync(
		Effect.gen(function* () {
			const runtime = yield* startFx();
			return yield* Effect.result(
				planDropPlacementFx({
					runtime,
					origin: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					drop: {
						type: "item",
						itemId: "log",
						quantity: 2,
						placement: "drop",
					},
				}),
			);
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(Result.isFailure(result)).toBe(true);
	if (Result.isFailure(result))
		expect(result.failure).toMatchObject({
			_tag: "PlacementUnavailableError",
			remainingQuantity: 1,
		});
});
