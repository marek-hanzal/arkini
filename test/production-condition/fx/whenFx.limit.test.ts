import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";
import { whenFx } from "~/production-condition/fx/whenFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { limitConfig, limitWhen } from "./whenFx.limit.test/fixture";

const boardFn = (x: number, space = 0) => ({
	scope: "board" as const,
	space,
	position: {
		x,
		y: 0,
	},
});
const readLimitFx = whenFx({
	origin: {
		scope: "inventory",
		position: {
			x: 0,
			y: 0,
		},
	},
	when: limitWhen,
});
const spawnBoardFx = (id: string, itemId: string, x: number, quantity = 1, space = 0) =>
	spawnItemFx({
		id,
		itemId,
		quantity,
		location: boardFn(x, space),
	});
const observeMaterialFx = Effect.gen(function* () {
	const runtime = yield* readRuntimeFx();
	return {
		limited: yield* readLimitFx,
		scopes: runtime.items
			.filter((item) => item.item.id === "token")
			.map((item) => item.location.scope)
			.sort(),
	};
});

describe("global live limit condition", () => {
	it("counts other Boards and passive storage independently of origin, while uncapped items stay false", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnBoardFx("other-board", "token", 0, 1, 1);
				yield* spawnItemFx({
					id: "inventory-token",
					itemId: "token",
					quantity: 1,
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				const below = yield* readLimitFx;
				yield* spawnItemFx({
					id: "toolbar-token",
					itemId: "token",
					quantity: 1,
					location: {
						scope: "toolbar",
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				yield* spawnBoardFx("uncapped", "uncapped", 1, 3);
				return {
					below,
					atLimit: yield* readLimitFx,
					uncapped: yield* whenFx({
						origin: boardFn(5),
						when: {
							type: "limit",
							itemId: "uncapped",
						},
					}),
				};
			}).pipe(
				useGameFx({
					config: limitConfig,
				}),
			),
		);
		expect(result).toEqual({
			below: false,
			atLimit: true,
			uncapped: false,
		});
	});

	it("keeps delivery, stored, consumed and reserved material in the live total until actual removal", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnBoardFx("consumer", "consumer", 0);
				yield* spawnBoardFx("material", "token", 1, 2);
				yield* spawnItemFx({
					id: "inventory-token",
					itemId: "token",
					quantity: 1,
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				yield* enqueueLineFx({
					ownerItemId: "consumer",
					lineId: "consume",
				});
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 100,
				});
				const travelling = yield* observeMaterialFx;
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 200,
				});
				const stored = yield* observeMaterialFx;
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 100,
				});
				const running = yield* observeMaterialFx;
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 900,
				});
				return {
					travelling,
					stored,
					running,
					completed: yield* observeMaterialFx,
				};
			}).pipe(
				useGameFx({
					config: limitConfig,
				}),
			),
		);
		expect(result).toEqual({
			travelling: {
				limited: true,
				scopes: [
					"delivery",
					"inventory",
				],
			},
			stored: {
				limited: true,
				scopes: [
					"input",
					"input",
					"inventory",
				],
			},
			running: {
				limited: true,
				scopes: [
					"inventory",
					"job",
					"reserved",
				],
			},
			completed: {
				limited: false,
				scopes: [
					"board",
					"inventory",
				],
			},
		});
	});

	it("fills the last slot despite its own reservation, then disables and reopens production after consumption", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnBoardFx("producer", "producer", 0);
				yield* spawnBoardFx("consumer", "consumer", 2);
				yield* spawnBoardFx("material", "token", 1, 2);
				yield* enqueueLineFx({
					ownerItemId: "producer",
					lineId: "produce",
				});
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 100,
				});
				const whileReserved = yield* readLimitFx;
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 100,
				});
				const full = yield* readLimitFx;
				const blocked = yield* Effect.result(
					enqueueLineFx({
						ownerItemId: "producer",
						lineId: "produce",
					}),
				);
				yield* enqueueLineFx({
					ownerItemId: "consumer",
					lineId: "consume",
				});
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 1500,
				});
				const reopened = yield* readLimitFx;
				yield* enqueueLineFx({
					ownerItemId: "producer",
					lineId: "produce",
				});
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 200,
				});
				return {
					whileReserved,
					full,
					blocked,
					reopened,
					refilled: yield* readLimitFx,
				};
			}).pipe(
				useGameFx({
					config: limitConfig,
				}),
			),
		);
		expect(result.whileReserved).toBe(false);
		expect(result.full).toBe(true);
		expect(Result.isFailure(result.blocked)).toBe(true);
		if (Result.isFailure(result.blocked))
			expect(result.blocked.failure._tag).toBe("LineRunUnavailableError");
		expect(result.reopened).toBe(false);
		expect(result.refilled).toBe(true);
	});
});
