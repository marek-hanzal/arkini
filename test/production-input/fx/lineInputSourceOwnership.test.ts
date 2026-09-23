import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { checkRuntimeFx } from "~/game-runtime/fx/checkRuntimeFx";
import { useGameFx } from "~test/support/useGameFx";
import { autofillLineInputsFx } from "~test/support/autofillLineInputsFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import { runTickRuntimeByFx } from "~test/game-tick/support/runTickRuntimeByFx";

const baseItem = (id: string) =>
	({
		uid: id,

		title: id,
		description: id,
		ui: "default" as const,
		artwork: {
			scale: 0.8,
			default: [
				`artwork:${id}`,
			],
		},
	}) as const;

const workerItemId = "producer:worker";
const upgradeItemId = "item:upgrade";
const fuelItemId = "item:fuel";
const workerOwnerItemId = "runtime:worker";
const upgradeOwnerItemId = "runtime:upgrade";
const fuelRuntimeItemId = "runtime:fuel";
const workerRunLineId = "line:worker:run";
const workerFuelLineId = "line:worker:fuel";
const upgradeLineId = "line:upgrade:construct";
const workerRunRequestId = "job:worker:run";
const upgradeRequestId = "job:upgrade";

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:line-input-source-ownership",
		title: "Line input source ownership",
		board: {
			width: 5,
			height: 2,
		},
	},
	start: {
		currentSpace: 0,
		spaces: [],
	},
	items: {
		[workerItemId]: {
			...baseItem(workerItemId),
			maxQueueSize: 2,

			lines: [
				{
					id: workerRunLineId,
					title: "Run",
					description: "Run without material.",
					runtimeMs: 1_000,
					input: [
						{
							type: "simple",
						},
					],
					rules: [],
				},
				{
					id: workerFuelLineId,
					title: "Fuel",
					description: "Wait for fuel.",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							query: {
								distance: "far" as const,
								selector: {
									type: "item",
									itemUid: fuelItemId,
								},
							},
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		[upgradeItemId]: {
			...baseItem(upgradeItemId),
			maxQueueSize: 1,

			lines: [
				{
					id: upgradeLineId,
					title: "Construct",
					description: "Consume one idle worker.",
					runtimeMs: 1_000,
					input: [
						{
							type: "materials",
							query: {
								distance: "far" as const,
								selector: {
									type: "item",
									itemUid: workerItemId,
								},
							},
							quantity: {
								min: 1,
								max: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		[fuelItemId]: {
			maxQueueSize: 1,
			lines: [],

			...baseItem(fuelItemId),
		},
	},
});

const item = (id: string, itemUid: string, x: number) => ({
	id,
	itemUid,
	location: {
		scope: "board" as const,
		space: 0,
		position: {
			x,
			y: 0,
		},
	},
});

const state = ({
	jobQueue,
	jobs = [],
	withFuel = false,
}: {
	readonly jobQueue: NonNullable<StateSchema.Type["jobQueue"]>;
	readonly jobs?: StateSchema.Type["jobs"];
	readonly withFuel?: boolean;
}) =>
	({
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		templateUidBySpace: {},
		items: [
			item(workerOwnerItemId, workerItemId, 0),
			item(upgradeOwnerItemId, upgradeItemId, 3),
			...(withFuel
				? [
						item(fuelRuntimeItemId, fuelItemId, 1),
					]
				: []),
		],
		jobs,
		jobQueue,
	}) satisfies StateSchema.Type;

const queueRequest = (id: string, ownerItemId: string, lineId: string) => ({
	id,
	ownerItemId,
	lineId,
});

describe("line input source ownership", () => {
	it("keeps an active owner out of autofill", () => {
		const activeState = state({
			jobQueue: [
				queueRequest(upgradeRequestId, upgradeOwnerItemId, upgradeLineId),
			],
			jobs: [
				{
					id: workerRunRequestId,
					ownerItemId: workerOwnerItemId,
					lineId: workerRunLineId,
					durationMs: 1_000,
					remainingMs: 900,
				},
			],
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const autofill = yield* autofillLineInputsFx({
					ownerItemId: upgradeOwnerItemId,
					lineId: upgradeLineId,
				});
				return {
					after: yield* readRuntimeFx(),
					autofill,
					before,
				};
			}).pipe(
				useGameFx({
					config,
					state: activeState,
				}),
			),
		);

		expect(result.autofill).toEqual({
			remainingMissingQuantity: 1,
			scheduledQuantity: 0,
		});
		expect(result.after).toEqual(result.before);
	});

	it("lets an earlier active job win without invalidating the later upgrade request", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config,
					state: state({
						jobQueue: [
							queueRequest(workerRunRequestId, workerOwnerItemId, workerRunLineId),
							queueRequest(upgradeRequestId, upgradeOwnerItemId, upgradeLineId),
						],
					}),
				}),
			),
		);
		const issues = Effect.runSync(
			checkRuntimeFx({
				runtime,
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(issues.issues).toEqual([]);
		expect(runtime.jobs).toEqual([
			expect.objectContaining({
				lineId: workerRunLineId,
				ownerItemId: workerOwnerItemId,
			}),
		]);
		expect(runtime.jobQueue).toEqual([
			queueRequest(upgradeRequestId, upgradeOwnerItemId, upgradeLineId),
		]);
		expect(runtime.items.find(({ id }) => id === workerOwnerItemId)?.location.scope).toBe(
			"board",
		);
	});

	it("rejects an enqueue committed after the source entered delivery", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* autofillLineInputsFx({
					ownerItemId: upgradeOwnerItemId,
					lineId: upgradeLineId,
				});
				const beforeEnqueue = yield* readRuntimeFx();
				const enqueue = yield* Effect.result(
					enqueueLineFx({
						ownerItemId: workerOwnerItemId,
						lineId: workerRunLineId,
					}),
				);
				return {
					afterEnqueue: yield* readRuntimeFx(),
					beforeEnqueue,
					enqueue,
				};
			}).pipe(
				useGameFx({
					config,
					state: state({
						jobQueue: [],
					}),
				}),
			),
		);

		expect(Result.isFailure(result.enqueue)).toBe(true);
		if (Result.isFailure(result.enqueue)) {
			expect(result.enqueue.failure).toMatchObject({
				_tag: "ItemNotOnBoardError",
				itemId: workerOwnerItemId,
			});
		}
		expect(result.afterEnqueue).toEqual(result.beforeEnqueue);
	});
});
