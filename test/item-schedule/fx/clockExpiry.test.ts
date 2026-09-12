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
			capacity: 0,
		},
	],
});

describe("Clock expiry settlement", () => {
	it("admits the tied last pulse, drains accepted runnable work and expires only after its last completion", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const expired = yield* tickClockFx(500);
				const nextJob = yield* tickClockFx(200);
				const settled = yield* tickClockFx(400);
				return {
					expired,
					nextJob,
					settled,
				};
			}).pipe(
				useGameFx({
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
				remainingMs: 400,
			},
		]);
		expect(result.nextJob.jobQueue).toHaveLength(0);
		expect(result.settled.items.filter((item) => item.item.id === "clock")).toHaveLength(0);
		expect(result.settled.items.filter((item) => item.item.id === "result")).toHaveLength(2);
		expect(result.settled.items.filter((item) => item.item.id === "expired")).toHaveLength(1);
	});

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
