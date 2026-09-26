import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createTileActorRuntime,
	createTemporaryTileActorRuntime,
	tileActorGame,
	tileActorTestConfig,
} from "~test/tile-presentation/support/tileActorTestFixture";
import { readTileActorsFx } from "~/tile-presentation/fx/readTileActorsFx";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const readMainActor = (runtime: RuntimeSchema.Type) =>
	Effect.runSync(
		readTileActorsFx({
			game: tileActorGame,
			runtime,
		}).pipe(Effect.provideService(GameConfigFx, tileActorTestConfig)),
	)[0];

describe("readTileActorsFx", () => {
	it("projects the complete default artwork composition with its authored scale", () => {
		const empty = readMainActor(
			createTileActorRuntime({
				owner: "blueprint",
				artworkScale: 0.625,
			}),
		);

		expect(empty).toMatchObject({
			artworkScale: 0.625,
			sourceUrl: "resource:artwork:blueprint-base",
			compositeUrl: "resource:artwork:blueprint-overlay",
		});
	});

	it("projects active work progress, activity, and queue count", () => {
		expect(
			readMainActor(
				createTileActorRuntime({
					active: true,
					queued: 2,
				}),
			),
		).toMatchObject({
			badgeCount: 3,
			colorFraction: 1,
			progressRatio: 0.5,
		});
	});

	it("hides instant-job indicators while retaining unit color and timed work", () => {
		const runtime = createTileActorRuntime({
			active: true,
		});
		const instant = readMainActor({
			...runtime,
			jobs: runtime.jobs.map((job) => ({
				...job,
				durationMs: 0,
				remainingMs: 0,
			})),
		});
		expect(instant?.progressRatio).toBeUndefined();
		expect(instant?.running).toBe(false);
		expect(instant?.badgeCount).toBeUndefined();
		expect(instant?.colorFraction).toBe(1);
		const completed = readMainActor({
			...runtime,
			jobs: runtime.jobs.map((job) => ({
				...job,
				remainingMs: 0,
			})),
		});
		expect(completed?.progressRatio).toBe(1);
		expect(completed?.badgeCount).toBe(1);
	});

	it("keeps a queued instant request visible while its material is missing", () => {
		const runtime = createTileActorRuntime({
			queued: 1,
		});
		const instant = RuntimeSchema.parse({
			...runtime,
			items: runtime.items.map((item) => ({
				...item,
				item: {
					...item.item,
					lines: item.item.lines.map((line) => ({
						...line,
						runtimeMs: 0,
					})),
				},
			})),
		});
		expect(readMainActor(instant)?.badgeCount).toBe(1);
		expect(
			readMainActor({
				...instant,
				items: instant.items.map((item) => ({
					...item,
					item: {
						...item.item,
						lines: item.item.lines.map((line) => ({
							...line,
							input: [],
						})),
					},
				})),
			})?.badgeCount,
		).toBeUndefined();
	});

	it("projects depletion from canonical units without a unit badge", () => {
		const runtime = createTileActorRuntime();
		const actor = readMainActor(
			RuntimeSchema.parse({
				...runtime,
				items: runtime.items.map((item) => ({
					...item,
					remainingUnits: 4,
					item: {
						...item.item,
						units: {
							amount: 10,
						},
					},
				})),
			}),
		);
		expect(actor?.colorFraction).toBe(0.4);
		expect(actor?.badgeCount).toBeUndefined();
	});

	it("keeps a zero-unit owner colored until its active job settles", () => {
		const runtime = createTileActorRuntime({
			active: true,
			owner: "blueprint",
		});
		const depleted = RuntimeSchema.parse({
			...runtime,
			items: runtime.items.map((item) => ({
				...item,
				remainingUnits: 0,
			})),
			jobs: runtime.jobs.map((job) => ({
				...job,
				terminalCause: "depleted",
			})),
		});
		expect(readMainActor(depleted)?.colorFraction).toBe(1);
		expect(
			readMainActor({
				...depleted,
				jobs: depleted.jobs.map((job) => ({
					...job,
					remainingMs: 0,
				})),
			})?.colorFraction,
		).toBe(1);
		expect(
			readMainActor({
				...depleted,
				jobs: [],
			})?.colorFraction,
		).toBe(0);
	});

	it("projects temporary lifetime without an activity effect", () => {
		const actor = readMainActor(createTemporaryTileActorRuntime());
		expect(actor).toMatchObject({
			progressRatio: 0.6,
		});
		expect(actor?.colorFraction).toBeUndefined();
	});

	it("keeps lifetime visible across an instant Clock job", () => {
		const runtime = createTileActorRuntime({
			active: true,
		});
		const scheduled = RuntimeSchema.parse({
			...runtime,
			items: runtime.items.map((item) => ({
				...item,
				item: {
					...item.item,
					clock: {
						durationMs: 1_000,
						intervalMs: 100,
					},
					lines: item.item.lines.map((line) => ({
						...line,
						runtimeMs: 0,
						trigger: "clock-interval",
						input: [],
					})),
				},
				schedule: {
					remainingDurationMs: 600,
					remainingIntervalMs: 100,
				},
			})),
			jobs: runtime.jobs.map((job) => ({
				...job,
				durationMs: 0,
				remainingMs: 0,
			})),
		});
		for (const jobs of [
			scheduled.jobs,
			[],
		]) {
			const actor = readMainActor({
				...scheduled,
				jobs,
			});
			expect(actor?.progressRatio).toBe(0.6);
			expect(actor?.running).toBe(false);
			expect(actor?.clockPulse).toMatchObject({
				enabled: true,
			});
		}
	});

	it("projects the saved pulse independently of a running job and full queue", () => {
		const runtime = createTileActorRuntime({
			active: true,
		});
		const scheduled = RuntimeSchema.parse({
			...runtime,
			items: runtime.items.map((item) =>
				item.id !== "runtime:owner"
					? item
					: {
							...item,
							item: {
								...item.item,
								clock: {
									intervalMs: 10_000,
								},
							},
							schedule: {
								remainingIntervalMs: 7_500,
							},
						},
			),
		});
		expect(readMainActor(scheduled)).toMatchObject({
			progressRatio: 0.5,
			running: true,
			clockPulse: {
				intervalMs: 10_000,
				remainingMs: 7_500,
				enabled: true,
			},
		});
	});

	it("uses the engine's Clock rule veto without pausing an accepted job", () => {
		const runtime = createTileActorRuntime({
			active: true,
		});
		const scheduled = RuntimeSchema.parse({
			...runtime,
			items: runtime.items.map((item) =>
				item.id !== "runtime:owner"
					? item
					: {
							...item,
							item: {
								...item.item,
								clock: {
									intervalMs: 10_000,
									rules: [
										{
											type: "disable",
											when: [
												{
													type: "exists",
													query: {
														distance: "self",
														selector: {
															type: "item",
															itemUid: item.item.uid,
														},
													},
												},
											],
										},
									],
								},
							},
							schedule: {
								remainingIntervalMs: 7_500,
							},
						},
			),
		});
		expect(readMainActor(scheduled)).toMatchObject({
			progressRatio: 0.5,
			running: true,
			clockPulse: {
				intervalMs: 10_000,
				remainingMs: 7_500,
				enabled: false,
			},
		});
	});

	it("keeps finite lifetime progress and removes pulse admission when exhausted", () => {
		const runtime = createTemporaryTileActorRuntime();
		expect(readMainActor(runtime)?.clockPulse).toBeUndefined();
		const scheduled = RuntimeSchema.parse({
			...runtime,
			items: runtime.items.map((item) => ({
				...item,
				item: {
					...item.item,
					clock: {
						...item.item.clock,
						intervalMs: 10_000,
					},
				},
				schedule: {
					...item.schedule,
					remainingIntervalMs: 7_500,
				},
			})),
		});
		expect(readMainActor(scheduled)).toMatchObject({
			progressRatio: 0.6,
			clockPulse: {
				intervalMs: 10_000,
				remainingMs: 7_500,
				enabled: true,
			},
		});
		const exhausted = RuntimeSchema.parse({
			...scheduled,
			items: scheduled.items.map((item) => ({
				...item,
				schedule: {
					...item.schedule,
					remainingDurationMs: 0,
				},
			})),
		});
		expect(readMainActor(exhausted)).toMatchObject({
			progressRatio: 0,
		});
		expect(readMainActor(exhausted)?.clockPulse).toBeUndefined();
	});
});
