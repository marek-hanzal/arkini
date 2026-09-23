import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { settleItemDeliveryFx } from "~test/support/settleItemDeliveryFx";
import { useGameFx } from "~test/support/useGameFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import { existsWhen } from "~test/production-line/support/lineTestRuntime";
import { setSpeedUpGameplayFx } from "~/game-cheat/fx/setSpeedUpGameplayFx";
import { setCheatEnabledFx } from "~/game-cheat/fx/setCheatEnabledFx";

const props = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
};

const createDisabledJobConfig = () => {
	const base = createJobTestConfig(2);
	const forge = base.items.forge;
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			permit: {
				...base.items.tool,
				uid: "permit",
			},
			forge: {
				...forge,
				lines: forge.lines.map((line) => ({
					...line,
					rules: [
						{
							type: "enable",
							when: [
								existsWhen("permit"),
							],
						},
					],
				})),
			},
		},
	});
};

const createExhaustedUnitJobConfig = () => {
	const base = createJobTestConfig(2);
	const forge = base.items.forge;
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			forge: {
				...forge,
				units: {
					amount: 1,
				},
				lines: forge.lines.map((line) => ({
					...line,
					input: line.input.map((input, index) =>
						index === 0
							? {
									...input,
									units: {
										cost: 2,
										from: "self",
									},
								}
							: input,
					),
				})),
			},
		},
	});
};

const createTimedQueueJobConfig = () => {
	const base = createJobTestConfig(3);
	const forge = base.items.forge;
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			forge: {
				...forge,
				lines: forge.lines.map((line) => ({
					...line,
					input: [
						{
							type: "simple",
						},
					],
				})),
			},
		},
	});
};

describe("enqueueLineFx", () => {
	it("appends an idle ready line without starting or filling it", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const request = yield* enqueueLineFx(props);
				return {
					request,
					runtime: yield* readRuntimeFx(),
					transition: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(2),
				}),
			),
		);

		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.jobQueue).toEqual([
			result.request,
		]);
		expect(result.runtime.items.filter((item) => item.location.scope === "input")).toHaveLength(
			4,
		);
		expect(result.transition.events).toContainEqual({
			type: "job:queued",
			requestId: result.request.id,
			itemUid: "forge",
			ownerItemId: props.ownerItemId,
			lineId: props.lineId,
		});
	});

	it("preserves interleaved cross-owner acceptance order in the canonical queue", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				for (const [id, x] of [
					[
						"runtime:forge:a",
						0,
					],
					[
						"runtime:forge:b",
						1,
					],
				] as const) {
					yield* spawnItemFx({
						id,
						itemUid: "forge",
						location: {
							scope: "board",
							space: 0,
							position: {
								x,
								y: 0,
							},
						},
					});
				}

				const first = yield* enqueueLineFx({
					ownerItemId: "runtime:forge:a",
					lineId: props.lineId,
				});
				const second = yield* enqueueLineFx({
					ownerItemId: "runtime:forge:b",
					lineId: props.lineId,
				});
				const third = yield* enqueueLineFx({
					ownerItemId: "runtime:forge:a",
					lineId: props.lineId,
				});

				return {
					requests: [
						first,
						second,
						third,
					],
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(3),
				}),
			),
		);

		expect(new Set(result.requests.map(({ id }) => id))).toHaveProperty("size", 3);
		expect(result.runtime.jobQueue).toEqual(result.requests);
	});

	it("appends an idle line while concrete material inputs are missing", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: props.ownerItemId,
					itemUid: "forge",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				const request = yield* enqueueLineFx(props);
				return {
					request,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(2),
				}),
			),
		);

		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.jobQueue).toEqual([
			result.request,
		]);
		expect(result.runtime.items).toHaveLength(1);
	});

	it("starts the exact queued head only after concrete Autofill deliveries settle", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: props.ownerItemId,
					itemUid: "forge",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				const request = yield* enqueueLineFx(props);
				for (let index = 0; index < 3; index += 1)
					yield* spawnItemFx({
						id: `runtime:water:${index}`,
						itemUid: "water",
						location: {
							scope: "board",
							space: 0,
							position: {
								x: index + 1,
								y: 0,
							},
						},
					});
				yield* spawnItemFx({
					id: "runtime:tool",
					itemUid: "tool",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 1,
						},
					},
				});

				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				const delivering = yield* readRuntimeFx();
				for (const item of delivering.items) {
					if (item.location.scope === "delivery")
						yield* settleItemDeliveryFx({
							itemId: item.id,
							generation: item.location.generation,
						});
				}

				const settled = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				return {
					delivering,
					request,
					runtime: yield* readRuntimeFx(),
					settled,
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(2),
				}),
			),
		);

		expect(result.delivering.jobs).toEqual([]);
		expect(result.delivering.jobQueue).toEqual([
			result.request,
		]);
		expect(result.settled.jobs).toEqual([]);
		expect(result.settled.jobQueue).toEqual([
			result.request,
		]);
		expect(result.runtime.jobQueue).toEqual([]);
		expect(result.runtime.jobs).toEqual([
			expect.objectContaining({
				lineId: props.lineId,
				ownerItemId: props.ownerItemId,
				remainingMs: 900,
			}),
		]);
		expect(result.runtime.jobs[0]?.id).not.toBe(result.request.id);
	});

	it("rejects a hard-disabled line instead of recording a waiting intent", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				const attempt = yield* Effect.result(enqueueLineFx(props));
				return {
					attempt,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createDisabledJobConfig(),
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "LineRunUnavailableError",
				ownerItemId: props.ownerItemId,
				lineId: props.lineId,
			});
		}
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.jobQueue).toEqual([]);
	});

	it("rejects exhausted self units even while concrete material is missing", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: props.ownerItemId,
					itemUid: "forge",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				return yield* Effect.result(enqueueLineFx(props));
			}).pipe(
				useGameFx({
					config: createExhaustedUnitJobConfig(),
				}),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "LineRunUnavailableError",
				ownerItemId: props.ownerItemId,
				lineId: props.lineId,
			});
		}
	});

	it("preserves authoritative queue capacity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* prepareJobLineFx();
				yield* enqueueLineFx(props);
				const second = yield* Effect.result(enqueueLineFx(props));
				return {
					second,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createJobTestConfig(1),
				}),
			),
		);

		expect(Result.isFailure(result.second)).toBe(true);
		if (Result.isFailure(result.second)) {
			expect(result.second.failure).toMatchObject({
				_tag: "JobQueueFullError",
				ownerItemId: props.ownerItemId,
			});
		}
		expect(result.runtime.jobs).toEqual([]);
		expect(result.runtime.jobQueue).toHaveLength(1);
	});

	it("keeps Speed-up queue playback bounded to the fixed-step lifecycle", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: props.ownerItemId,
					itemUid: "forge",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
				});
				yield* setSpeedUpGameplayFx({
					enabled: true,
				});
				yield* setCheatEnabledFx({
					enabled: true,
				});
				yield* enqueueLineFx(props);
				yield* enqueueLineFx(props);
				yield* enqueueLineFx(props);
				for (let step = 0; step < 10; step++) {
					yield* runTickRuntimeByFx({
						elapsedMs: 10,
					});
				}
				const afterFirstStep = yield* readRuntimeFx();
				for (let step = 0; step < 10; step++) {
					yield* runTickRuntimeByFx({
						elapsedMs: 10,
					});
				}
				const afterSecondStep = yield* readRuntimeFx();
				for (let step = 0; step < 10; step++) {
					yield* runTickRuntimeByFx({
						elapsedMs: 10,
					});
				}
				return {
					afterFirstStep,
					afterSecondStep,
					afterThirdStep: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createTimedQueueJobConfig(),
					speedUpMultiplier: 10,
				}),
			),
		);

		expect(result.afterFirstStep.jobQueue).toHaveLength(1);
		expect(result.afterFirstStep.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 1_000,
			}),
		]);
		expect(result.afterSecondStep.jobQueue).toEqual([]);
		expect(result.afterSecondStep.jobs).toEqual([
			expect.objectContaining({
				remainingMs: 1_000,
			}),
		]);
		expect(result.afterThirdStep.jobQueue).toEqual([]);
		expect(result.afterThirdStep.jobs).toEqual([]);
	});
});
