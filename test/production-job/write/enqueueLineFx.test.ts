import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { settleItemDeliveryFx } from "~test/support/delivery/settleItemDeliveryFx";
import { useGameFx } from "~test/support/game/useGameFx";
import { enqueueLineFx } from "~/production-job/write/enqueueLineFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { runTickRuntimeByFx } from "~test/support/tick/runTickRuntimeByFx";
import { createJobTestConfig, prepareJobLineFx } from "~test/production-job/support/jobTestConfig";
import { existsWhen } from "~test/production-line/fx/support/lineTestRuntime";
import { setInstantGameplayFx } from "~/engine/cheat/write/setInstantGameplayFx";
import { setCheatEnabledFx } from "~/engine/cheat/write/setCheatEnabledFx";

const props = {
	ownerItemId: "runtime:forge",
	lineId: "line:forge:run",
};

const createDisabledJobConfig = () => {
	const base = createJobTestConfig(2);
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			permit: {
				...base.items.tool,
				uid: "permit",
				id: "permit",
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

const createExhaustedChargeJobConfig = () => {
	const base = createJobTestConfig(2);
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			forge: {
				...forge,
				charges: {
					amount: 1,
				},
				lines: forge.lines.map((line) => ({
					...line,
					input: line.input.map((input, index) =>
						index === 0
							? {
									...input,
									charges: {
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

const createStackedJobConfig = () => {
	const base = createJobTestConfig(2);
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			forge: {
				...forge,
				maxStackSize: 2,
			},
		},
	});
};

const createInstantQueueJobConfig = () => {
	const base = createJobTestConfig(3);
	const forge = base.items.forge;
	if (forge.type !== "producer") throw new Error("Expected producer fixture.");
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
			2,
		);
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
						itemId: "forge",
						location: {
							scope: "board",
							space: 0,
							position: {
								x,
								y: 0,
							},
						},
						quantity: 1,
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
					itemId: "forge",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
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
					itemId: "forge",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				const request = yield* enqueueLineFx(props);
				yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 3,
				});
				yield* spawnItemFx({
					id: "runtime:tool",
					itemId: "tool",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				const delivering = yield* readRuntimeFx();
				yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				yield* settleItemDeliveryFx({
					itemId: "runtime:tool",
					generation: 0,
				});
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

	it("rejects exhausted self charges even while concrete material is missing", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: props.ownerItemId,
					itemId: "forge",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				return yield* Effect.result(enqueueLineFx(props));
			}).pipe(
				useGameFx({
					config: createExhaustedChargeJobConfig(),
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

	it("isolates a stacked owner before attaching the queue intent", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: props.ownerItemId,
					itemId: "forge",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 2,
				});
				const request = yield* enqueueLineFx(props);
				return {
					request,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createStackedJobConfig(),
				}),
			),
		);

		expect(result.runtime.jobQueue).toEqual([
			result.request,
		]);
		expect(result.runtime.items.filter((item) => item.item.id === "forge")).toHaveLength(2);
		expect(result.runtime.items.find((item) => item.id === props.ownerItemId)).toMatchObject({
			quantity: 1,
		});
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

	it("keeps Instant queue playback bounded to the fixed-step lifecycle", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: props.ownerItemId,
					itemId: "forge",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				yield* setInstantGameplayFx({
					enabled: true,
				});
				yield* setCheatEnabledFx({
					enabled: true,
				});
				yield* enqueueLineFx(props);
				yield* enqueueLineFx(props);
				yield* enqueueLineFx(props);
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				const afterFirstStep = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				const afterSecondStep = yield* readRuntimeFx();
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				return {
					afterFirstStep,
					afterSecondStep,
					afterThirdStep: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: createInstantQueueJobConfig(),
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
