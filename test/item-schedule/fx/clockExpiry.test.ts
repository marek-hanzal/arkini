import { setCheatEnabledFx } from "~/game-cheat/fx/setCheatEnabledFx";
import { setSpeedUpGameplayFx } from "~/game-cheat/fx/setSpeedUpGameplayFx";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { enqueueLineRuntimeFx } from "~/production-job/fx/enqueueLineRuntimeFx";
import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import { useGameFx } from "~test/support/useGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
import {
	createLine,
	createExpiryLine,
	createOutput,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { createClockConfig, spawnClockItemFx, tickClockFx } from "./clockSchedule.test/fixture";

const expiryOutput = createOutput([
	{
		itemUid: "expired",
	},
]);
const materialLine = createLine({
	uid: "material",
	default: false,
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
});

describe("Clock expiry settlement", () => {
	it("reserves terminal-line enqueue for the Clock scheduler", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const runtime = yield* readRuntimeFx();
				const expired = {
					...runtime,
					items: runtime.items.map((item) => ({
						...item,
						schedule: {
							...item.schedule!,
							remainingDurationMs: 0,
						},
					})),
				};
				return yield* enqueueLineRuntimeFx({
					ownerItemId: "runtime:clock",
					lineUid: "line:expiry",
					runtime: expired,
				}).pipe(
					Effect.map(() => "queued" as const),
					Effect.catchTag("LineRunUnavailableError", () =>
						Effect.succeed("unavailable" as const),
					),
				);
			}).pipe(
				useGameFx({
					config: createClockConfig({
						lines: [
							createExpiryLine(expiryOutput),
						],
						clock: {
							intervalMs: undefined,
							durationMs: 100,
						},
					}),
				}),
			),
		);
		expect(result).toBe("unavailable");
	});

	it("starts a lifetime line with its stored input through ordinary job settlement", () => {
		const input = {
			type: "materials" as const,
			query: {
				distance: "far" as const,
				selector: {
					type: "item" as const,
					itemUid: "permit",
				},
			},
			mode: "consume" as const,
			quantity: {
				min: 1,
				max: 1,
			},
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const material = yield* spawnClockItemFx("permit", 1);
				yield* bufferInputMaterialForTestFx({
					ownerItemId: "runtime:clock",
					lineUid: "line:expiry",
					inputIndex: 0,
					sourceItemId: material.id,
					sourceItemRevision: material.revision,
				});
				const started = yield* tickClockFx(100);
				const completed = yield* tickClockFx(100);
				return {
					started,
					completed,
				};
			}).pipe(
				useGameFx({
					config: createClockConfig({
						lines: [
							{
								...createExpiryLine(expiryOutput),
								input: [
									input,
								],
								runtimeMs: 100,
							},
						],
						clock: {
							durationMs: 100,
							intervalMs: undefined,
						},
					}),
				}),
			),
		);
		expect(result.started.jobs).toMatchObject([
			{
				lineUid: "line:expiry",
				remainingMs: 100,
			},
		]);
		expect(
			result.started.items.find((item) => item.item.uid === "permit")?.location.scope,
		).toBe("job");
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.items.map((item) => item.item.uid)).toEqual([
			"expired",
		]);
	});
	it("runs an expiry line as a timed job before settling its output and owner", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const triggered = yield* tickClockFx(100);
				const working = yield* tickClockFx(200);
				const completed = yield* tickClockFx(100);
				return {
					triggered,
					working,
					completed,
				};
			}).pipe(
				useGameFx({
					config: createClockConfig({
						lines: [
							{
								...createExpiryLine(expiryOutput),
								runtimeMs: 300,
							},
						],
						clock: {
							durationMs: 100,
						},
					}),
				}),
			),
		);
		expect(result.triggered.jobs).toMatchObject([
			{
				lineUid: "line:expiry",
				remainingMs: 300,
			},
		]);
		expect(result.working.jobs).toMatchObject([
			{
				remainingMs: 100,
			},
		]);
		expect(result.working.items.some((item) => item.item.uid === "expired")).toBe(false);
		expect(result.completed.jobs).toEqual([]);
		expect(result.completed.items.some((item) => item.item.uid === "clock")).toBe(false);
		expect(result.completed.items.filter((item) => item.item.uid === "expired")).toHaveLength(
			1,
		);
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
							lines: [
								...createClockConfig().items.clock!.lines,
								createExpiryLine(expiryOutput),
							],
							clock: {
								durationMs: 500,
							},
						}),
					}),
				),
			);
			expect(
				result.expired.items.find((item) => item.item.uid === "clock")?.schedule
					?.remainingDurationMs,
			).toBe(0);
			expect(result.expired.jobs).toHaveLength(1);
			expect(result.expired.jobQueue).toMatchObject([
				{
					lineUid: "a",
				},
				{
					lineUid: "line:expiry",
				},
			]);
			expect(result.nextJob.jobs).toMatchObject([
				{
					lineUid: "a",
					remainingMs: 100,
				},
			]);
			expect(result.nextJob.jobQueue).toMatchObject([
				{
					lineUid: "line:expiry",
				},
			]);
			expect(result.settled.items.filter((item) => item.item.uid === "clock")).toHaveLength(
				0,
			);
			expect(result.settled.items.filter((item) => item.item.uid === "result")).toHaveLength(
				2,
			);
			expect(result.settled.items.filter((item) => item.item.uid === "expired")).toHaveLength(
				1,
			);
		},
	);

	it("gives no extra capacity to the final pulse while reserving one terminal request", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnClockItemFx();
				const expired = yield* tickClockFx(500);
				const settled = yield* tickClockFx(200);
				const completed = yield* tickClockFx(100);
				return {
					expired,
					settled,
					completed,
				};
			}).pipe(
				useGameFx({
					config: createClockConfig({
						maxQueueSize: 1,
						lines: [
							...createClockConfig().items.clock!.lines,
							createExpiryLine(expiryOutput),
						],
						clock: {
							durationMs: 500,
						},
					}),
				}),
			),
		);
		expect(result.expired.jobs).toHaveLength(1);
		expect(result.expired.jobQueue).toMatchObject([
			{
				lineUid: "line:expiry",
			},
		]);
		expect(result.settled.items.filter((item) => item.item.uid === "result")).toHaveLength(1);
		expect(result.settled.jobs).toMatchObject([
			{
				lineUid: "line:expiry",
			},
		]);
		expect(result.completed.items.filter((item) => item.item.uid === "clock")).toHaveLength(0);
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
			result.inFlight.items.find((item) => item.item.uid === "permit")?.location.scope,
		).toBe("delivery");
		expect(result.expired.items.some((item) => item.item.uid === "clock")).toBe(false);
		expect(result.expired.jobQueue).toHaveLength(0);
		expect(result.returned.items).toMatchObject([
			{
				item: {
					uid: "permit",
				},

				location: {
					scope: "board",
				},
			},
		]);
	});

	it("keeps blocked expiry atomic and preserves its random outcome across retries", () => {
		const outcome = OutcomeTableSchema.parse({
			set: [
				{
					rules: [],
					roll: [
						{
							type: "guaranteed",
							outcome: [
								{
									type: "item" as const,
									itemUid: "expired",
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
						itemUid: "permit",

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
				const first = yield* advanceRuntimeStepFx(free).pipe(Random.withSeed("first"));
				const second = yield* advanceRuntimeStepFx(free).pipe(Random.withSeed("second"));
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
								uid: "unused",
							}),
							createExpiryLine(outcome),
						],
						clock: {
							intervalMs: 100,
							durationMs: 100,
						},
					}),
				}),
			),
		);
		expect(
			result.blocked.items.find((item) => item.item.uid === "clock")?.schedule
				?.remainingDurationMs,
		).toBe(0);
		expect(result.retry).toEqual(result.blocked);
		expect(
			result.first.runtime.items.map(({ item, location }) => ({
				itemId: item.uid,
				location,
			})),
		).toEqual(
			result.second.runtime.items.map(({ item, location }) => ({
				itemId: item.uid,
				location,
			})),
		);
		expect(result.first.runtime.items.some((item) => item.item.uid === "clock")).toBe(false);
		expect(result.first.runtime.items.length).toBeGreaterThanOrEqual(2);
	});
});
