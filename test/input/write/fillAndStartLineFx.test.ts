import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { settleItemDeliveryFx } from "~/engine/delivery/write/settleItemDeliveryFx";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";
import { fillAndStartLineRuntimeFx } from "~/engine/job/fx/fillAndStartLineRuntimeFx";
import { fillAndStartLineFx } from "~/engine/job/write/fillAndStartLineFx";
import { readCommittedTransitionFx } from "~/engine/runtime/read/readCommittedTransitionFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

const ownerItemId = "runtime:workshop";
const lineId = "line:workshop:build";

const spawnOwnerFx = () =>
	spawnItemFx({
		id: ownerItemId,
		itemId: "workshop",
		location: workshopLocation,
		quantity: 1,
	});

const spawnWaterFx = (quantity: number) =>
	spawnItemFx({
		id: "runtime:water",
		itemId: "water",
		location: sourceLocation(1),
		quantity,
	});

describe("fillAndStartLineFx", () => {
	it("partially fills when current concrete Autofill coverage is incomplete", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx(2);
				const before = yield* readRuntimeFx();
				const command = yield* fillAndStartLineFx({
					lineId,
					ownerItemId,
				});
				const after = yield* readRuntimeFx();
				return {
					after,
					before,
					command,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.command).toEqual({
			type: "filled",
			remainingMissingQuantity: 1,
			scheduledQuantity: 2,
		});
		expect(result.after).not.toBe(result.before);
		expect(result.after.jobs).toHaveLength(0);
		expect(result.after.items.find((item) => item.id === "runtime:water")).toMatchObject({
			location: {
				phase: "outbound",
				scope: "delivery",
			},
			quantity: 2,
		});
	});

	it("starts only after exact Autofill sources physically settle", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx(7);
				const command = yield* fillAndStartLineFx({
					lineId,
					ownerItemId,
				});
				const beforeContact = yield* readRuntimeFx();
				yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				return {
					beforeContact,
					command,
					runtime: yield* readRuntimeFx(),
					transition: yield* readCommittedTransitionFx(),
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.command).toEqual({
			type: "filled",
			remainingMissingQuantity: 0,
			scheduledQuantity: 3,
		});
		expect(result.beforeContact.jobs).toHaveLength(0);
		expect(
			result.beforeContact.items.find((item) => item.id === "runtime:water"),
		).toMatchObject({
			location: {
				phase: "outbound",
				scope: "delivery",
			},
			quantity: 7,
		});
		expect(result.runtime.jobs).toEqual([
			expect.objectContaining({
				lineId,
				ownerItemId,
			}),
		]);
		expect(result.runtime.items.find((item) => item.id === "runtime:water")).toMatchObject({
			location: {
				phase: "returning",
				scope: "delivery",
			},
			quantity: 4,
		});
		expect(
			result.runtime.items.find(
				(item) =>
					item.item.id === "water" &&
					item.location.scope === "job" &&
					item.location.jobId === result.runtime.jobs[0]?.id,
			),
		).toMatchObject({
			quantity: 3,
		});
		expect(result.transition.events.map((event) => event.type)).toEqual(
			expect.arrayContaining([
				GameEventEnumSchema.enum.JobStarted,
				GameEventEnumSchema.enum.ItemConsumed,
			]),
		);
	});

	it("rejects a stale explicit action while the owner already has queued work", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx(3);
				const before = yield* readRuntimeFx();
				const queued = {
					...before,
					jobQueue: [
						{
							id: "job:queued",
							ownerItemId,
							lineId,
						},
					],
				};
				const attempt = yield* Effect.result(
					fillAndStartLineRuntimeFx({
						lineId,
						ownerItemId,
						runtime: queued,
					}),
				);
				return {
					attempt,
					queued,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "JobOwnerBusyError",
				ownerItemId,
			});
		}
		expect(result.queued.jobs).toEqual([]);
		expect(result.queued.jobQueue).toHaveLength(1);
	});

	it("rejects a stale explicit action while the owner already has an active job", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx(6);
				yield* fillAndStartLineFx({
					lineId,
					ownerItemId,
				});
				yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(
					fillAndStartLineFx({
						lineId,
						ownerItemId,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "JobOwnerBusyError",
				ownerItemId,
			});
		}
		expect(result.after).toBe(result.before);
		expect(result.after.jobs).toHaveLength(1);
	});

	it("waits rather than treating an unsettled delivery as atomic concrete coverage", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx(3);
				yield* autofillLineInputsFx({
					lineId,
					ownerItemId,
				});
				const before = yield* readRuntimeFx();
				const command = yield* fillAndStartLineFx({
					lineId,
					ownerItemId,
				});
				return {
					after: yield* readRuntimeFx(),
					before,
					command,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.command).toEqual({
			type: "fill-unavailable",
			missingQuantity: 3,
		});
		expect(result.after).toBe(result.before);
		expect(result.after.jobs).toHaveLength(0);
		expect(result.after.items.find((item) => item.id === "runtime:water")).toMatchObject({
			location: {
				phase: "outbound",
				scope: "delivery",
			},
		});
	});

	it("consumes only the exact queue head identity after complete coverage", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx(3);
				yield* autofillLineInputsFx({
					lineId,
					ownerItemId,
				});
				yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				const before = yield* readRuntimeFx();
				const request = {
					id: "job:request-head",
					ownerItemId,
					lineId,
				};
				const queued = {
					...before,
					jobQueue: [
						request,
					],
				};
				const started = yield* fillAndStartLineRuntimeFx({
					lineId,
					ownerItemId,
					queueRequestId: request.id,
					runtime: queued,
				});
				return {
					queued,
					started,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.started.type).toBe("started");
		expect(result.started.runtime.jobQueue).toEqual([]);
		expect(result.started.runtime.jobs).toHaveLength(1);
		expect(result.queued.jobQueue).toEqual([
			expect.objectContaining({
				id: "job:request-head",
			}),
		]);
	});

	it("retains a stale or non-head queue request without planning a mutation", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnOwnerFx();
				yield* spawnWaterFx(3);
				const before = yield* readRuntimeFx();
				const queued = {
					...before,
					jobQueue: [
						{
							id: "job:request-head",
							ownerItemId,
							lineId,
						},
						{
							id: "job:request-later",
							ownerItemId,
							lineId,
						},
					],
				};
				return yield* fillAndStartLineRuntimeFx({
					lineId,
					ownerItemId,
					queueRequestId: "job:request-later",
					runtime: queued,
				});
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result).toMatchObject({
			type: "queue-request-unavailable",
			reason: "not-head",
		});
		expect(result.runtime.jobs).toHaveLength(0);
		expect(result.runtime.jobQueue).toHaveLength(2);
		expect(result.runtime.items.find((item) => item.id === "runtime:water")).toMatchObject({
			location: sourceLocation(1),
			quantity: 3,
		});
	});
});
