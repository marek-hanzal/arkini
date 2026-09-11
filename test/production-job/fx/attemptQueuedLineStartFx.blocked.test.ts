import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { attemptQueuedLineStartFx } from "~/production-job/fx/attemptQueuedLineStartFx";
import { advanceRuntimeStepFx } from "~/game-tick/fx/advanceRuntimeStepFx";
import { useGameFx } from "~test/support/useGameFx";
import {
	createBlockedQueueFixture,
	type Blocker,
} from "./attemptQueuedLineStartFx.blocked.test/fixture";

describe("queued blocked probes", () => {
	it.each<Blocker>([
		"missing-input",
		"rule",
		"self-charge",
		"aggregate-self-charge",
		"target-charge",
		"output-capacity",
		"placement",
	])(
		"preserves input, charges, reservations, deliveries and randomness on %s rejection",
		(blocker) => {
			const { config, runtime, request } = createBlockedQueueFixture(blocker);
			const snapshot = structuredClone(runtime);
			const expectedRandom = Effect.runSync(
				Random.next.pipe(Random.withSeed("queue-probes")),
			);
			const result = Effect.runSync(
				Effect.gen(function* () {
					const first = yield* attemptQueuedLineStartFx({
						requestId: request.id,
						runtime,
					});
					const retry = yield* attemptQueuedLineStartFx({
						requestId: request.id,
						runtime: first.runtime,
					});
					const random = yield* Random.next;
					const later = yield* attemptQueuedLineStartFx({
						requestId: "request:ready",
						runtime: retry.runtime,
					});
					return {
						first,
						retry,
						random,
						later,
					};
				}).pipe(
					Random.withSeed("queue-probes"),
					useGameFx({
						config,
					}),
				),
			);

			const errorTag =
				blocker === "placement"
					? "PlacementUnavailableError"
					: blocker === "output-capacity"
						? "OutputCapacityError"
						: "LineRunUnavailableError";
			for (const attempt of [
				result.first,
				result.retry,
			]) {
				expect(attempt).toMatchObject({
					type: "blocked",
					error: {
						_tag: errorTag,
					},
				});
				expect(attempt.runtime).toBe(runtime);
				expect(attempt).not.toHaveProperty("events");
			}
			expect(runtime).toEqual(snapshot);
			expect(result.random).toBe(expectedRandom);
			expect(result.later.type).toBe("started");
			expect(result.later.runtime.jobQueue).toEqual([
				request,
			]);
			expect(result.later.runtime.items.find((item) => item.id === "buffer")).toEqual(
				snapshot.items.find((item) => item.id === "buffer"),
			);
		},
	);

	it("does not let mixed missing and buffered input costs claim Autofill priority beyond the shared charge budget", () => {
		const { config, runtime, request } = createBlockedQueueFixture("aggregate-self-charge");
		const result = Effect.runSync(
			advanceRuntimeStepFx(runtime).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.runtime.jobs).toMatchObject([
			{
				ownerItemId: request.ownerItemId,
				lineId: "ready",
			},
		]);
		expect(result.runtime.jobQueue).toEqual([
			request,
		]);
		expect(result.runtime.items).toEqual(runtime.items);
		expect(result.events).toMatchObject([
			{
				type: "job:started",
				lineId: "ready",
			},
		]);
	});

	it("starts the same previously placement-blocked request after space is freed", () => {
		const { config, runtime, request } = createBlockedQueueFixture("placement");
		const result = Effect.runSync(
			Effect.gen(function* () {
				const blocked = yield* attemptQueuedLineStartFx({
					requestId: request.id,
					runtime,
				});
				const started = yield* attemptQueuedLineStartFx({
					requestId: request.id,
					runtime: {
						...blocked.runtime,
						items: blocked.runtime.items.filter((item) => item.id !== "result"),
					},
				});
				return {
					blocked,
					started,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);
		expect(result.blocked.type).toBe("blocked");
		expect(result.started.type).toBe("started");
		expect(result.started.runtime.jobQueue.map(({ id }) => id)).toEqual([
			"request:ready",
		]);
		expect(
			result.started.runtime.items.filter((item) => item.item.id === "debris"),
		).toHaveLength(2);
		expect(
			result.started.runtime.items.find((item) => item.id === "owner")?.remainingCharges,
		).toBe(2);
		expect(
			result.started.runtime.items.find((item) => item.id === "buffer")?.location.scope,
		).toBe("job");
		expect(
			result.started.runtime.items.find((item) => item.id === "tool")?.location.scope,
		).toBe("reserved");
	});
});
