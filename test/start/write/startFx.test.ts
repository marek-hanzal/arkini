import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/v1/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { readArkiniGameConfigSource } from "~test/schema/support/readArkiniGameConfigSource";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";
import { startFx } from "~/v1/start/write/startFx";

describe("startFx", () => {
	it("atomically creates the configured board and inventory runtime", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const started = yield* startFx();
				const read = yield* readRuntimeFx();

				return {
					read,
					started,
				};
			}).pipe(
				useGameFx({
					config: startTestConfig,
				}),
			),
		);

		expect(result.started).toBe(result.read);
		expect(result.started.items).toHaveLength(3);
		expect(result.started.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: startTestConfig.items.tree,
					location: {
						position: {
							x: 1,
							y: 1,
						},
						scope: "board",
					},
					quantity: 1,
				}),
				expect.objectContaining({
					item: startTestConfig.items.log,
					location: {
						position: {
							x: 0,
							y: 0,
						},
						scope: "inventory",
					},
					quantity: 3,
				}),
				expect.objectContaining({
					item: startTestConfig.items.log,
					location: {
						position: {
							x: 1,
							y: 0,
						},
						scope: "inventory",
					},
					quantity: 1,
				}),
			]),
		);
	});

	it("rejects an already populated runtime without changing it", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:existing",
					itemId: "tree",
					location: {
						position: {
							x: 0,
							y: 0,
						},
						scope: "board",
					},
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const started = yield* Effect.either(startFx());
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

		expect(Either.isLeft(result.started)).toBe(true);
		if (Either.isLeft(result.started)) {
			expect(result.started.left).toMatchObject({
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
				board: [
					{
						itemId: "tree",
						x: 0,
						y: 0,
					},
					{
						itemId: "tree",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const started = yield* Effect.either(startFx());
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

		expect(Either.isLeft(result.started)).toBe(true);
		if (Either.isLeft(result.started)) {
			expect(result.started.left).toMatchObject({
				_tag: "RuntimeInvalidError",
			});
		}
		expect(result.runtime.items).toEqual([]);
	});

	it("rolls back the complete start when initial inventory cannot fit", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			meta: {
				...startTestConfig.meta,
				inventory: {
					width: 1,
					height: 1,
				},
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const started = yield* Effect.either(startFx());
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

		expect(Either.isLeft(result.started)).toBe(true);
		if (Either.isLeft(result.started)) {
			expect(result.started.left).toMatchObject({
				_tag: "StartInventoryUnavailableError",
				itemId: "log",
				remainingQuantity: 1,
			});
		}
		expect(result.runtime.items).toEqual([]);
	});

	it("boots the current Arkini authoring config into a valid runtime", () => {
		const source = readArkiniGameConfigSource();
		const config = GameConfigSchema.parse(source.value);
		const runtime = Effect.runSync(
			startFx().pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(runtime.items).toHaveLength(14);
		expect(runtime.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					item: config.items["producer:townhall-t1"],
					location: {
						position: {
							x: 3,
							y: 4,
						},
						scope: "board",
					},
				}),
				expect.objectContaining({
					item: config.items["item:magnifying-glass"],
					location: {
						position: {
							x: 0,
							y: 0,
						},
						scope: "inventory",
					},
					quantity: 1,
				}),
			]),
		);
	});
});
