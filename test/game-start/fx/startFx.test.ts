import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { startTestConfig } from "~test/game-start/support/startTestConfig";
import { startFx } from "~/game-start/fx/startFx";

describe("startFx", () => {
	it("commits the exact sequential runtime for repeated item definitions in separate cells", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			start: {
				currentSpace: 0,
				board: [
					{
						itemId: "log",
						space: 0,
						x: 0,
						y: 0,
					},
					{
						itemId: "log",
						space: 0,
						x: 1,
						y: 0,
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

	it("rolls back the complete start when exact board placements conflict", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			start: {
				currentSpace: 0,
				board: [
					{
						space: 0,
						itemId: "tree",
						x: 0,
						y: 0,
					},
					{
						space: 0,
						itemId: "tree",
						x: 0,
						y: 0,
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
		if (Result.isFailure(result.started)) {
			expect(result.started.failure).toMatchObject({
				_tag: "RuntimeInvalidError",
			});
		}
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
