import { setCheatEnabledFx } from "~/game-cheat/fx/setCheatEnabledFx";
import { setSpeedUpGameplayFx } from "~/game-cheat/fx/setSpeedUpGameplayFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";
import { expireIdleScheduledItemsFx } from "~/item-schedule/fx/expireIdleScheduledItemsFx";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import { useGameFx } from "~test/support/useGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import {
	createLine,
	createOutput,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { createClockConfig, spawnClockItemFx, tickClockFx } from "./clockSchedule.test/fixture";

const expiryOutput = createOutput([
	{
		itemId: "expired",
	},
]);
const materialLine = createLine({
	id: "material",
	default: true,
	clock: true,
	input: [
		{
			type: "materials",
			selector: {
				type: "item",
				itemId: "permit",
			},
			mode: "consume",
			quantity: {
				min: 1,
				max: 1,
			},
		},
	],
});

describe("Clock expiry settlement", () => {
	it.each([
		"inventory",
		"toolbar",
	] as const)("expires in %s and places output through that storage scope", (scope) => {
		const base = createClockConfig({
			scope: "any",
			lines: [],
			clock: {
				intervalMs: undefined,
				durationMs: 100,
				onExpire: expiryOutput,
			},
		});
		const config = GameConfigSchema.parse({
			...base,
			meta: {
				...base.meta,
				toolbarSize: 2,
			},
			items: {
				...base.items,
				expired: {
					...base.items.expired,
					scope: "any",
				},
			},
		});
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:clock",
					itemId: "clock",
					quantity: 1,
					location: {
						scope,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				return yield* tickClockFx(100);
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(runtime.items.some((item) => item.item.id === "clock")).toBe(false);
		expect(runtime.items.find((item) => item.item.id === "expired")?.location).toMatchObject({
			scope,
		});
	});

	it.each([
		"inventory",
		"toolbar",
	] as const)("places Board-only expiry output on the current Board from %s", (scope) => {
		const base = createClockConfig({
			scope: "any",
			lines: [],
			clock: {
				intervalMs: undefined,
				durationMs: 100,
				onExpire: expiryOutput,
			},
		});
		const config = GameConfigSchema.parse({
			...base,
			meta: {
				...base.meta,
				toolbarSize: 2,
			},
		});
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:clock",
					itemId: "clock",
					quantity: 1,
					location: {
						scope,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				return yield* tickClockFx(100);
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(runtime.items.some((item) => item.id === "runtime:clock")).toBe(false);
		expect(runtime.items.find((item) => item.item.id === "expired")?.location).toMatchObject({
			scope: "board",
			space: 0,
		});
	});

	it("keeps expiry atomic when its Toolbar-only output has no Toolbar capacity", () => {
		const base = createClockConfig({
			scope: "any",
			lines: [],
			clock: {
				intervalMs: undefined,
				durationMs: 100,
				onExpire: expiryOutput,
			},
		});
		const config = GameConfigSchema.parse({
			...base,
			meta: {
				...base.meta,
				toolbarSize: 1,
			},
			items: {
				...base.items,
				expired: {
					...base.items.expired,
					scope: "toolbar",
				},
			},
		});
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:clock",
					itemId: "clock",
					quantity: 1,
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				yield* spawnItemFx({
					id: "runtime:toolbar:blocker",
					itemId: "permit",
					quantity: 1,
					location: {
						scope: "toolbar",
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				return yield* tickClockFx(100);
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(runtime.items).toContainEqual(
			expect.objectContaining({
				id: "runtime:clock",
				location: expect.objectContaining({
					scope: "inventory",
				}),
				schedule: {
					remainingDurationMs: 0,
				},
			}),
		);
		expect(runtime.items.some((item) => item.item.id === "expired")).toBe(false);
		expect(runtime.jobs).toEqual([]);
		expect(runtime.jobQueue).toEqual([]);
	});

	it("lets an any-scope expiry output fall through passive storage to the current Board", () => {
		const output = OutputSchema.parse({
			set: [
				{
					rules: [],
					roll: [
						{
							type: "guaranteed",
							drop: [
								{
									itemId: "expired",
									quantity: {
										min: 2,
										max: 2,
									},
									placement: "drop",
									rules: [],
								},
							],
						},
					],
				},
			],
		});
		const base = createClockConfig({
			scope: "any",
			lines: [],
			clock: {
				intervalMs: undefined,
				durationMs: 100,
				onExpire: output,
			},
		});
		const config = GameConfigSchema.parse({
			...base,
			meta: {
				...base.meta,
				toolbarSize: 1,
			},
			items: {
				...base.items,
				expired: {
					...base.items.expired,
					scope: "any",
				},
			},
		});
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:clock",
					itemId: "clock",
					quantity: 1,
					location: {
						scope: "toolbar",
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				for (let index = 0; index < 4; index++) {
					yield* spawnItemFx({
						id: `runtime:inventory:blocker:${index}`,
						itemId: "permit",
						quantity: 1,
						location: {
							scope: "inventory",
							position: {
								x: index % 2,
								y: Math.floor(index / 2),
							},
						},
					});
				}
				return yield* tickClockFx(100);
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(runtime.items.some((item) => item.id === "runtime:clock")).toBe(false);
		expect(
			runtime.items
				.filter((item) => item.item.id === "expired")
				.map((item) => item.location.scope)
				.sort(),
		).toEqual([
			"board",
			"toolbar",
		]);
		expect(
			runtime.items.find(
				(item) => item.item.id === "expired" && item.location.scope === "board",
			)?.location,
		).toMatchObject({
			scope: "board",
			space: 0,
		});
	});

	it.each([
		1,
		5,
	])(
		"preserves the last pulse and drains accepted work before expiry at injected speed %s",
		(speedUpMultiplier) => {
			const result = Effect.runSync(
				Effect.gen(function* () {
					yield* spawnClockItemFx();
					yield* setCheatEnabledFx({
						enabled: true,
					});
					yield* setSpeedUpGameplayFx({
						enabled: true,
					});
					for (let step = 0; step < 5; step++) {
						yield* tickClockFx(100 / speedUpMultiplier);
					}
					const expired = yield* tickClockFx(0);
					for (let step = 0; step < 5; step++) {
						yield* tickClockFx(100 / speedUpMultiplier);
					}
					const nextJob = yield* tickClockFx(0);
					for (let step = 0; step < 5; step++) {
						yield* tickClockFx(100 / speedUpMultiplier);
					}
					const settled = yield* tickClockFx(0);
					return {
						expired,
						nextJob,
						settled,
					};
				}).pipe(
					useGameFx({
						speedUpMultiplier,
						config: createClockConfig({
							maxQueueSize: 2,
							clock: {
								durationMs: 500,
								onExpire: expiryOutput,
							},
						}),
					}),
				),
			);
			expect(
				result.expired.items.find((item) => item.item.id === "clock")?.schedule
					?.remainingDurationMs,
			).toBe(0);
			expect(result.expired.jobs).toHaveLength(1);
			expect(result.expired.jobQueue).toMatchObject([
				{
					lineId: "a",
				},
			]);
			expect(result.nextJob.jobs).toMatchObject([
				{
					lineId: "a",
					remainingMs: 100,
				},
			]);
			expect(result.nextJob.jobQueue).toHaveLength(0);
			expect(result.settled.items.filter((item) => item.item.id === "clock")).toHaveLength(0);
			expect(result.settled.items.filter((item) => item.item.id === "result")).toHaveLength(
				2,
			);
			expect(result.settled.items.filter((item) => item.item.id === "expired")).toHaveLength(
				1,
			);
		},
	);

	it("gives no extra capacity to the final pulse when an active job already fills the queue limit", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const expired = yield* tickClockFx(500);
				const settled = yield* tickClockFx(200);
				return {
					expired,
					settled,
				};
			}).pipe(
				useGameFx({
					config: createClockConfig({
						maxQueueSize: 1,
						clock: {
							durationMs: 500,
							onExpire: expiryOutput,
						},
					}),
				}),
			),
		);
		expect(result.expired.jobs).toHaveLength(1);
		expect(result.expired.jobQueue).toHaveLength(0);
		expect(result.settled.items.filter((item) => item.item.id === "result")).toHaveLength(1);
		expect(result.settled.items.filter((item) => item.item.id === "clock")).toHaveLength(0);
	});

	it("does not start Autofill for incomplete final-pulse work", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const material = yield* spawnClockItemFx("permit", 5);
				const settled = yield* tickClockFx(100);
				return {
					material,
					settled,
				};
			}).pipe(
				useGameFx({
					config: createClockConfig({
						lines: [
							materialLine,
						],
						clock: {
							intervalMs: 100,
							durationMs: 100,
						},
					}),
				}),
			),
		);
		expect(result.settled.items).toEqual([
			result.material,
		]);
		expect(result.settled.jobQueue).toHaveLength(0);
		expect(result.settled.jobs).toHaveLength(0);
	});

	it("expires without waiting for material in flight and returns it through ordinary delivery settlement", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				yield* spawnClockItemFx("permit", 5);
				const inFlight = yield* tickClockFx(100);
				const expired = yield* tickClockFx(100);
				const returned = yield* tickClockFx(2000);
				return {
					inFlight,
					expired,
					returned,
				};
			}).pipe(
				useGameFx({
					config: createClockConfig({
						lines: [
							materialLine,
						],
						clock: {
							intervalMs: 100,
							durationMs: 200,
						},
					}),
				}),
			),
		);
		expect(
			result.inFlight.items.find((item) => item.item.id === "permit")?.location.scope,
		).toBe("delivery");
		expect(result.expired.items.some((item) => item.item.id === "clock")).toBe(false);
		expect(result.expired.jobQueue).toHaveLength(0);
		expect(result.returned.items).toMatchObject([
			{
				item: {
					id: "permit",
				},
				quantity: 1,
				location: {
					scope: "board",
				},
			},
		]);
	});

	it("keeps blocked expiry atomic and preserves its random output across retries", () => {
		const output = OutputSchema.parse({
			set: [
				{
					rules: [],
					roll: [
						{
							type: "guaranteed",
							drop: [
								{
									itemId: "expired",
									quantity: {
										min: 2,
										max: 3,
									},
									placement: "random",
									rules: [],
								},
							],
						},
					],
				},
			],
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				for (let position = 1; position < 12; position++)
					yield* spawnItemFx({
						id: `blocker:${position}`,
						itemId: "permit",
						quantity: 1,
						location: {
							scope: "board",
							space: 0,
							position: {
								x: position % 6,
								y: Math.floor(position / 6),
							},
						},
					});
				const blocked = yield* tickClockFx(100);
				const retry = yield* tickClockFx(100);
				const free = {
					...retry,
					items: retry.items.filter((item) => !item.id.startsWith("blocker:")),
				};
				const first = yield* expireIdleScheduledItemsFx(free).pipe(
					Random.withSeed("first"),
				);
				const second = yield* expireIdleScheduledItemsFx(free).pipe(
					Random.withSeed("second"),
				);
				return {
					blocked,
					retry,
					first,
					second,
				};
			}).pipe(
				useGameFx({
					config: createClockConfig({
						lines: [
							createLine({
								id: "unused",
							}),
						],
						clock: {
							intervalMs: 100,
							durationMs: 100,
							onExpire: output,
						},
					}),
				}),
			),
		);
		expect(
			result.blocked.items.find((item) => item.item.id === "clock")?.schedule
				?.remainingDurationMs,
		).toBe(0);
		expect(result.retry).toEqual(result.blocked);
		expect(
			result.first.runtime.items.map(({ item, quantity, location }) => ({
				itemId: item.id,
				quantity,
				location,
			})),
		).toEqual(
			result.second.runtime.items.map(({ item, quantity, location }) => ({
				itemId: item.id,
				quantity,
				location,
			})),
		);
		expect(result.first.runtime.items.some((item) => item.item.id === "clock")).toBe(false);
		expect(result.first.runtime.items.length).toBeGreaterThanOrEqual(2);
	});
});
