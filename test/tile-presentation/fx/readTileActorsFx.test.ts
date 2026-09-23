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
			badgeKind: "queue",
			progressRatio: 0.5,
		});
	});

	it("hides instant-job indicators without hiding units or a timed job at completion", () => {
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
		expect(instant?.badgeKind).toBe("units");
		expect(instant?.badgeCount).toBe(1);
		const completed = readMainActor({
			...runtime,
			jobs: runtime.jobs.map((job) => ({
				...job,
				remainingMs: 0,
			})),
		});
		expect(completed?.progressRatio).toBe(1);
		expect(completed?.badgeKind).toBe("queue");
	});

	it("projects remaining units for an idle finite item", () => {
		expect(readMainActor(createTileActorRuntime())).toMatchObject({
			badgeCount: 1,
			badgeKind: "units",
		});
	});

	it("projects temporary lifetime without an activity effect", () => {
		expect(readMainActor(createTemporaryTileActorRuntime())).toMatchObject({
			progressRatio: 0.6,
		});
	});

	it("projects the saved pulse independently of a running job and full queue, with no Clock line selected", () => {
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
								lineIds: [],
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
