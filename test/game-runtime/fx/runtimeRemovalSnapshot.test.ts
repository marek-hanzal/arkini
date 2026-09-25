import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { createLine } from "~test/game-config-validation/support/gameValidationTestSource";
import {
	createClockConfig,
	spawnClockItemFx,
} from "~test/item-schedule/fx/clockSchedule.test/fixture";
import { useGameFx } from "~test/support/useGameFx";

const configFn = (runtimeMs = 1000) =>
	createClockConfig({
		units: {
			amount: 1,
		},
		clock: {
			durationMs: 100,
		},
		terminationMode: "kill-switch",
		lines: [
			{
				...createLine({
					uid: "work",
					input: [
						{
							type: "simple",
							units: {
								from: "self",
								cost: 1,
							},
						},
					],
				}),
				runtimeMs,
			},
		],
	});

describe("committed runtime removal snapshots", () => {
	it("publishes the complete terminal item, including changes made inside the removal transaction", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const initial = yield* spawnClockItemFx();
				const terminal = yield* modifyRuntimeFx((runtime) =>
					Effect.gen(function* () {
						const item = yield* reviseRuntimeItemFx({
							item: {
								...initial,
								remainingUnits: 0,
								mergeSequence: 7,
								schedule: {
									...initial.schedule!,
									remainingDurationMs: 0,
								},
							},
						});
						const removal = yield* removeRuntimeItemIdentityFx({
							item,
							runtime: {
								...runtime,
								items: [
									item,
								],
							},
						});
						return [
							item,
							removal.runtime,
							removal.events,
						] as const;
					}),
				);
				const transitions = yield* CommittedTransitionsFx;
				return {
					initial,
					terminal,
					transition: yield* transitions.read,
				};
			}).pipe(
				useGameFx({
					config: configFn(),
				}),
			),
		);

		expect(result.transition.previousRuntime?.items[0]).toBe(result.initial);
		expect(result.transition.runtime.items).toEqual([]);
		expect(result.transition.events).toEqual([
			{
				type: "item:removed",
				snapshot: result.terminal,
			},
		]);
		const event = result.transition.events.find(
			(candidate) => candidate.type === "item:removed",
		);
		expect(event?.snapshot).toBe(result.terminal);
		expect(event?.snapshot.revision).not.toBe(result.initial.revision);
		expect(event?.snapshot).toMatchObject({
			item: result.initial.item,
			location: result.initial.location,

			remainingUnits: 0,
			mergeSequence: 7,
			schedule: {
				remainingDurationMs: 0,
			},
		});
	});

	it("captures zero units and the unadvanced Clock when a queued job depletes its owner", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const initial = yield* spawnClockItemFx();
				yield* modifyRuntimeFx((runtime) =>
					Effect.succeed([
						undefined,
						{
							...runtime,
							jobQueue: [
								{
									id: "queued:work",
									ownerItemId: initial.id,
									lineUid: "work",
								},
							],
						},
					] as const),
				);
				yield* modifyRuntimeFx((runtime) =>
					advanceRuntimeStepFx(runtime).pipe(
						Effect.map(
							(step) =>
								[
									undefined,
									step.runtime,
									step.facts,
								] as const,
						),
					),
				);
				const transitions = yield* CommittedTransitionsFx;
				return {
					initial,
					transition: yield* transitions.read,
				};
			}).pipe(
				useGameFx({
					config: configFn(),
				}),
			),
		);

		const removal = result.transition.events.find((event) => event.type === "item:removed");
		expect(result.transition.previousRuntime?.items[0].remainingUnits).toBeUndefined();
		expect(result.transition.runtime.items).toEqual([]);
		expect(result.transition.runtime.jobs).toEqual([]);
		expect(result.transition.events).toContainEqual(
			expect.objectContaining({
				type: "job:started",
				itemUid: result.initial.item.uid,
			}),
		);
		expect(result.transition.events).toContainEqual(
			expect.objectContaining({
				type: "job:aborted",
				itemUid: result.initial.item.uid,
			}),
		);
		expect(result.transition.events).toContainEqual(
			expect.objectContaining({
				type: "item:depleted",
			}),
		);
		expect(removal?.snapshot).toMatchObject({
			id: result.initial.id,
			item: result.initial.item,
			location: result.initial.location,

			remainingUnits: 0,
			schedule: {
				remainingDurationMs: 100,
				remainingIntervalMs: 250,
			},
		});
		expect(removal?.snapshot.revision).not.toBe(result.initial.revision);
	});

	it("retains job abort identity when a kill switch removes the depleted owner", () => {
		const step = Effect.runSync(
			Effect.gen(function* () {
				const owner = yield* spawnClockItemFx();
				const runtime = yield* readRuntimeFx();
				return yield* advanceRuntimeStepFx({
					...runtime,
					jobQueue: [
						{
							id: "queued:work",
							ownerItemId: owner.id,
							lineUid: "work",
						},
					],
				});
			}).pipe(
				useGameFx({
					config: configFn(0),
				}),
			),
		);
		expect(step.runtime.items).toEqual([]);
		expect(step.facts).toContainEqual(
			expect.objectContaining({
				type: "job:aborted",
				ownerItemId: "runtime:clock",
				itemUid: "clock",
			}),
		);
	});

	it.each([
		false,
		true,
	])(
		"keeps only the last capture and excludes restored identities (restored: %s)",
		(restored) => {
			const result = Effect.runSync(
				Effect.gen(function* () {
					const initial = yield* spawnClockItemFx();
					const terminal = yield* modifyRuntimeFx((runtime) =>
						Effect.gen(function* () {
							const first = yield* removeRuntimeItemIdentityFx({
								item: initial,
								runtime,
							});
							const item = yield* reviseRuntimeItemFx({
								item: {
									...initial,
									mergeSequence: 7,
								},
							});
							const second = yield* removeRuntimeItemIdentityFx({
								item,
								runtime: {
									...first.runtime,
									items: [
										item,
									],
								},
							});
							return [
								item,
								restored
									? {
											...second.runtime,
											items: [
												item,
											],
										}
									: second.runtime,
								[
									...first.events,
									...second.events,
								],
							] as const;
						}),
					);
					const transitions = yield* CommittedTransitionsFx;
					return {
						terminal,
						transition: yield* transitions.read,
					};
				}).pipe(
					useGameFx({
						config: configFn(),
					}),
				),
			);

			expect(result.transition.events).toEqual(
				restored
					? []
					: [
							{
								type: "item:removed",
								snapshot: result.terminal,
							},
						],
			);
			expect(result.transition.runtime.items).toEqual(
				restored
					? [
							result.terminal,
						]
					: [],
			);
		},
	);

	it("does not publish a removed snapshot when the enclosing transaction fails", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const item = yield* spawnClockItemFx();
				const transitions = yield* CommittedTransitionsFx;
				const before = yield* transitions.read;
				const attempt = yield* Effect.result(
					modifyRuntimeFx((runtime) =>
						Effect.gen(function* () {
							yield* removeRuntimeItemIdentityFx({
								item,
								runtime,
							});
							return yield* Effect.fail("rejected-after-removal");
						}),
					),
				);
				return {
					before,
					attempt,
					after: yield* transitions.read,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: configFn(),
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		expect(result.after).toBe(result.before);
		expect(result.runtime).toBe(result.before.runtime);
		expect(result.after.events.some((event) => event.type === "item:removed")).toBe(false);
	});
});
