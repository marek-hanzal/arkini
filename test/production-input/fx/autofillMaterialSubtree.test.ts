import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { advanceRuntimeElapsedFx } from "~/game-tick/fx/advanceRuntimeElapsedFx";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { clearItemJobQueueFx } from "~/production-job/fx/clearItemJobQueueFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";
import { useGameFx } from "~test/support/useGameFx";

const configFn = (mode: "reserve" | "consume") => {
	const workshop = inputRuntimeTestConfig.items.workshop;
	return GameConfigSchema.parse({
		...inputRuntimeTestConfig,
		meta: {
			...inputRuntimeTestConfig.meta,
		},
		items: {
			...inputRuntimeTestConfig.items,
			recycler: {
				...workshop,
				uid: "recycler",
				lines: [
					{
						...workshop.lines[0],
						uid: "recycle",
						input: [
							{
								type: "materials",
								mode,
								query: {
									distance: "far" as const,
									selector: {
										type: "item",
										itemUid: "workshop",
									},
								},
								quantity: {
									min: 1,
									max: 1,
								},
							},
						],
					},
				],
			},
		},
	});
};

const originFn = (): BoardLocationSchema.Type => ({
	scope: "board",
	space: 0,
	position: {
		x: 2,
		y: 0,
	},
});

const stateFn = (origin: BoardLocationSchema.Type): StateSchema.Type => ({
	cheats: {
		enabled: false,
		everEnabled: false,
		speedUpGameplay: false,
	},
	currentSpace: 0,
	templateUidBySpace: {},
	items: [
		{
			id: "receiver",
			itemUid: "recycler",

			location: sourceLocation(0),
		},
		{
			id: "source",
			itemUid: "workshop",

			location: origin,
		},
		{
			id: "water",
			itemUid: "water",

			location: {
				scope: "input",
				ownerItemId: "source",
				lineUid: "line:workshop:build",
				inputIndex: 0,
			},
		},
	],
	jobs: [],
	jobQueue: [],
});

const dispatchFx = Effect.fn("dispatchFx")(function* () {
	const before = yield* readRuntimeFx();
	yield* enqueueLineFx({
		ownerItemId: "receiver",
		lineUid: "recycle",
	});
	yield* advanceRuntimeElapsedFx({
		elapsedMs: 100,
	});
	const outbound = yield* readRuntimeFx();
	const source = outbound.items.find(({ id }) => id === "source");
	if (source?.location.scope !== "delivery" || source.location.phase !== "outbound") {
		return yield* Effect.die(new Error("Expected the buffered producer to enter delivery."));
	}
	expect(outbound.items.find(({ id }) => id === "water")).toEqual(
		before.items.find(({ id }) => id === "water"),
	);
	expect(outbound.items).toHaveLength(before.items.length);
	return {
		before,
		location: source.location,
	};
});

const settleDeliveryFx = Effect.fn("settleDeliveryFx")(function* () {
	const dispatched = yield* dispatchFx();
	yield* advanceRuntimeElapsedFx({
		elapsedMs: dispatched.location.remainingDurationMs,
	});
	const stored = yield* readRuntimeFx();
	expect(stored.jobs).toEqual([]);
	expect(stored.items.find(({ id }) => id === "source")?.location).toMatchObject({
		scope: "input",
		ownerItemId: "receiver",
		lineUid: "recycle",
	});
	expect(stored.items.find(({ id }) => id === "water")).toEqual(
		dispatched.before.items.find(({ id }) => id === "water"),
	);
	return dispatched;
});

describe("Autofill material subtree ownership", () => {
	it("discards a consumed producer's buffer only when its job starts", () => {
		Effect.runSync(
			Effect.gen(function* () {
				yield* settleDeliveryFx();
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 100,
				});
				const started = yield* readRuntimeFx();
				expect(started.items.find(({ id }) => id === "source")?.location.scope).toBe("job");
				expect(started.items.some(({ id }) => id === "water")).toBe(false);
				yield* advanceRuntimeElapsedFx({
					elapsedMs: 1_000,
				});
				const completed = yield* readRuntimeFx();
				expect(completed.jobs).toEqual([]);
				expect(completed.items.map(({ id }) => id)).toEqual([
					"receiver",
				]);
			}).pipe(
				useGameFx({
					config: configFn("consume"),
					state: stateFn(sourceLocation(2)),
				}),
			),
		);
	});
});

it("preserves a reserved producer and its buffer from Board through delivery and completion", () => {
	const origin = originFn();
	Effect.runSync(
		Effect.gen(function* () {
			const dispatched = yield* settleDeliveryFx();
			expect(dispatched.location.origin).toEqual(origin);
			yield* advanceRuntimeElapsedFx({
				elapsedMs: 100,
			});
			const started = yield* readRuntimeFx();
			expect(started.items.find(({ id }) => id === "source")?.location.scope).toBe(
				"reserved",
			);
			expect(started.items.find(({ id }) => id === "water")).toEqual(
				dispatched.before.items.find(({ id }) => id === "water"),
			);
			yield* advanceRuntimeElapsedFx({
				elapsedMs: 1_000,
			});
			const completed = yield* readRuntimeFx();
			expect(completed.jobs).toEqual([]);
			expect(completed.items.find(({ id }) => id === "source")).toMatchObject({
				location: {
					scope: "board",
				},
			});
			expect(completed.items.find(({ id }) => id === "water")).toEqual(
				dispatched.before.items.find(({ id }) => id === "water"),
			);
		}).pipe(
			useGameFx({
				config: configFn("reserve"),
				state: stateFn(origin),
			}),
		),
	);
});
it("returns the same producer and buffer to its Board lease when the queue is cleared", () => {
	const origin = originFn();
	Effect.runSync(
		Effect.gen(function* () {
			const dispatched = yield* dispatchFx();
			yield* clearItemJobQueueFx({
				ownerItemId: "receiver",
			});
			const canceled = yield* readRuntimeFx();
			expect(canceled.items.find(({ id }) => id === "source")?.location).toMatchObject({
				scope: "delivery",
				phase: "returning",
				origin,
			});
			yield* advanceRuntimeElapsedFx({
				elapsedMs: 1_000,
			});
			const returned = yield* readRuntimeFx();
			expect(returned.jobQueue).toEqual([]);
			expect(returned.jobs).toEqual([]);
			expect(returned.items.find(({ id }) => id === "source")).toMatchObject({
				location: origin,
			});
			expect(returned.items.find(({ id }) => id === "water")).toEqual(
				dispatched.before.items.find(({ id }) => id === "water"),
			);
			expect(returned.items).toHaveLength(dispatched.before.items.length);
		}).pipe(
			useGameFx({
				config: configFn("reserve"),
				state: stateFn(origin),
			}),
		),
	);
});
