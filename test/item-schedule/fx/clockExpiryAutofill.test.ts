import { Effect } from "effect";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceItemSchedulesFx } from "~/item-schedule/fx/advanceItemSchedulesFx";
import { describe, expect, it } from "vitest";
import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import { createLine } from "~test/game-config-validation/support/gameValidationTestSource";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { useGameFx } from "~test/support/useGameFx";
import { createClockConfig, spawnClockItemFx, tickClockFx } from "./clockSchedule.test/fixture";

const runRangePulseFx = (durationMs: number) =>
	Effect.gen(function* () {
		yield* spawnClockItemFx();
		const material = yield* spawnClockItemFx("permit", 1);
		yield* bufferInputMaterialForTestFx({
			ownerItemId: "runtime:clock",
			lineUid: "range",
			inputIndex: 0,
			sourceItemId: material.id,
			sourceItemRevision: material.revision,
		});
		const spare = yield* spawnItemFx({
			id: "spare",
			itemUid: "permit",

			location: {
				scope: "board",
				space: 0,
				position: {
					x: 2,
					y: 0,
				},
			},
		});
		const pulsed = yield* tickClockFx(100);
		const settled = yield* tickClockFx(500);
		return {
			pulsed,
			settled,
			spare,
		};
	}).pipe(
		useGameFx({
			config: createClockConfig({
				lines: [
					{
						...createLine({
							uid: "range",
							trigger: "clock-interval",
							input: [
								{
									type: "materials",
									query: {
										distance: "far",
										selector: {
											type: "item",
											itemUid: "permit",
										},
									},
									mode: "consume",
									quantity: {
										min: 1,
										max: 2,
									},
								},
							],
						}),
						runtimeMs: 500,
					},
				],
				clock: {
					intervalMs: 100,
					durationMs,
				},
			}),
		}),
	);

describe("Clock expiry and optional Autofill", () => {
	it("does not enqueue an expiry line against material expiring in the same pass", () => {
		const base = createClockConfig({
			lines: [
				createLine({
					uid: "expiry",
					trigger: "item-termination",
					input: [
						{
							type: "materials",
							query: {
								distance: "far",
								selector: {
									type: "item",
									itemUid: "permit",
								},
							},
							mode: "consume",
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
				}),
			],
			clock: {
				intervalMs: undefined,
				durationMs: 100,
			},
		});
		const config = GameConfigSchema.parse({
			...base,
			items: {
				...base.items,
				permit: {
					...base.items.permit,
					clock: {
						durationMs: 100,
					},
				},
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx("clock", 0);
				yield* spawnClockItemFx("permit", 1);
				const expired = yield* tickClockFx(100);
				const later = yield* tickClockFx(200);
				return {
					expired,
					later,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.expired.jobQueue).toEqual([]);
		expect(result.expired.items).toEqual([]);
		expect(result.later.jobQueue).toEqual([]);
	});

	it("does not queue two expiring owners against one Board material", () => {
		const config = createClockConfig({
			lines: [
				createLine({
					uid: "expiry",
					trigger: "item-termination",
					input: [
						{
							type: "materials",
							query: {
								distance: "far",
								selector: {
									type: "item",
									itemUid: "permit",
								},
							},
							mode: "consume",
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
				}),
			],
			clock: {
				intervalMs: undefined,
				durationMs: 100,
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx("clock", 0);
				yield* spawnItemFx({
					id: "runtime:second-clock",
					itemUid: "clock",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
				});
				yield* spawnClockItemFx("permit", 2);
				const expired = yield* tickClockFx(100);
				const settled = yield* tickClockFx(500);
				return {
					expired,
					settled,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.expired.jobQueue).toHaveLength(1);
		expect(result.expired.items.filter((item) => item.item.uid === "clock")).toHaveLength(1);
		expect(result.settled.jobQueue).toEqual([]);
		expect(result.settled.items.some((item) => item.item.uid === "clock")).toBe(false);
	});

	it("does not count expired stored material when admitting a Clock pulse", () => {
		const config = createClockConfig({
			lines: [
				createLine({
					uid: "material",
					trigger: "clock-interval",
					input: [
						{
							type: "materials",
							query: {
								distance: "far",
								selector: {
									type: "item",
									itemUid: "permit",
								},
							},
							mode: "consume",
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
				}),
			],
			clock: {
				intervalMs: 100,
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const material = yield* spawnClockItemFx("permit", 1);
				yield* bufferInputMaterialForTestFx({
					ownerItemId: "runtime:clock",
					lineUid: "material",
					inputIndex: 0,
					sourceItemId: material.id,
					sourceItemRevision: material.revision,
				});
				const runtime = yield* readRuntimeFx();
				const expired = {
					...runtime,
					items: runtime.items.map((item) =>
						item.id === material.id
							? {
									...item,
									schedule: {
										remainingDurationMs: 0,
									},
								}
							: item,
					),
				};
				return yield* advanceItemSchedulesFx({
					stepStart: expired,
					runtime: expired,
				});
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.runtime.jobQueue).toEqual([]);
	});
	it("claims a Board source for one Clock owner when two pulse together", () => {
		const config = createClockConfig({
			lines: [
				createLine({
					uid: "material",
					trigger: "clock-interval",
					input: [
						{
							type: "materials",
							query: {
								distance: "far",
								selector: {
									type: "item",
									itemUid: "permit",
								},
							},
							mode: "consume",
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
				}),
			],
			clock: {
				intervalMs: 100,
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx("clock", 0);
				yield* spawnItemFx({
					id: "runtime:second-clock",
					itemUid: "clock",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
				});
				yield* spawnClockItemFx("permit", 1);
				return yield* tickClockFx(100);
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.jobQueue).toHaveLength(1);
		expect(result.items.filter((item) => item.location.scope === "delivery")).toHaveLength(1);
	});
	it("skips a pulse without material instead of leaving a waiting job in the queue", () => {
		const config = createClockConfig({
			lines: [
				createLine({
					uid: "material",
					trigger: "clock-interval",
					input: [
						{
							type: "materials",
							query: {
								distance: "far",
								selector: {
									type: "item",
									itemUid: "permit",
								},
							},
							mode: "consume",
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
				}),
			],
			clock: {
				intervalMs: 100,
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const missing = yield* tickClockFx(100);
				yield* spawnClockItemFx("permit", 1);
				const available = yield* tickClockFx(100);
				return {
					missing,
					available,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.missing.jobQueue).toEqual([]);
		expect(result.missing.jobs).toEqual([]);
		expect(result.available.jobQueue.length + result.available.jobs.length).toBe(1);
	});
	it("runs a startable final pulse without collecting an optional range top-up", () => {
		const { pulsed, settled, spare } = Effect.runSync(runRangePulseFx(100));

		expect(pulsed.jobs).toMatchObject([
			{
				ownerItemId: "runtime:clock",
				lineUid: "range",
				remainingMs: 500,
			},
		]);
		expect(pulsed.jobQueue).toEqual([]);
		expect(pulsed.items.find((item) => item.id === spare.id)).toEqual(spare);
		expect(pulsed.items.find((item) => item.id === "runtime:permit")?.location.scope).toBe(
			"job",
		);
		expect(settled.jobs).toEqual([]);
		expect(settled.items).toEqual([
			spare,
		]);
	});

	it("still collects the optional range top-up while lifetime remains", () => {
		const { pulsed } = Effect.runSync(runRangePulseFx(1000));

		expect(pulsed.jobs).toEqual([]);
		expect(pulsed.jobQueue).toMatchObject([
			{
				ownerItemId: "runtime:clock",
				lineUid: "range",
			},
		]);
		expect(pulsed.items.find((item) => item.id === "spare")?.location).toMatchObject({
			scope: "delivery",
			phase: "outbound",
		});
	});
});
