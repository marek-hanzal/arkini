import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { checkRuntimeFx } from "~/engine/runtime/check/checkRuntimeFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { readItemDetailMaterialAutofillAvailabilityFx } from "~/engine/item-detail/read/readItemDetailMaterialAutofillAvailabilityFx";
import { enqueueLineFx } from "~/engine/job/write/enqueueLineFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { runTickRuntimeByFx } from "~/engine/tick/fx/runTickRuntimeByFx";

const baseItem = (id: string) =>
	({
		uid: id,
		id,
		title: id,
		description: id,
		asset: {
			default: [
				`asset:${id}`,
			],
		},
		tags: [],
		categoryId: "test",
		scope: "any",
		maxStackSize: 1,
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
const workerFuelRequestId = "job:worker:fuel";
const upgradeRequestId = "job:upgrade";

const config = GameConfigSchema.parse({
	version: "1.0",
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
		inventory: {
			width: 3,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
	},
	categories: {},
	items: {
		[workerItemId]: {
			...baseItem(workerItemId),
			maxQueueSize: 2,
			type: "producer",
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
							selector: {
								type: "item",
								itemId: fuelItemId,
							},
							quantity: {
								type: "value",
								value: 1,
							},
						},
					],
					rules: [],
				},
			],
		},
		[upgradeItemId]: {
			...baseItem(upgradeItemId),
			type: "blueprint",
			line: {
				id: upgradeLineId,
				title: "Construct",
				description: "Consume one idle worker.",
				runtimeMs: 1_000,
				input: [
					{
						type: "materials",
						selector: {
							type: "item",
							itemId: workerItemId,
						},
						quantity: {
							type: "value",
							value: 1,
						},
					},
				],
				rules: [],
			},
		},
		[fuelItemId]: {
			...baseItem(fuelItemId),
			type: "simple",
		},
	},
});

const item = (id: string, itemId: string, x: number) => ({
	id,
	itemId,
	location: {
		scope: "board" as const,
		space: 0,
		position: {
			x,
			y: 0,
		},
	},
	quantity: 1,
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
			instantGameplay: false,
		},
		currentSpace: 0,
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
	it("clears queue-only source intent and returns its incoming material before delivery", () => {
		const runtime = Effect.runSync(
			Effect.gen(function* () {
				yield* runTickRuntimeByFx({
					elapsedMs: 100,
				});
				return yield* readRuntimeFx();
			}).pipe(
				useGameFx({
					config,
					state: {
						...state({
							jobQueue: [
								queueRequest(
									workerFuelRequestId,
									workerOwnerItemId,
									workerFuelLineId,
								),
								queueRequest(upgradeRequestId, upgradeOwnerItemId, upgradeLineId),
							],
							withFuel: true,
						}),
						defaultLineByOwnerItemId: {
							[workerOwnerItemId]: workerFuelLineId,
						},
					},
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
		expect(runtime.jobs).toEqual([]);
		expect(runtime.jobQueue).toEqual([
			queueRequest(upgradeRequestId, upgradeOwnerItemId, upgradeLineId),
		]);
		expect(runtime.defaultLineByOwnerItemId).toBeUndefined();
		expect(runtime.items.find(({ id }) => id === workerOwnerItemId)).toMatchObject({
			location: {
				scope: "delivery",
				phase: "outbound",
				target: {
					ownerItemId: upgradeOwnerItemId,
					lineId: upgradeLineId,
				},
			},
		});
		expect(runtime.items.find(({ id }) => id === fuelRuntimeItemId)).toMatchObject({
			location: {
				scope: "delivery",
				phase: "returning",
			},
		});
	});

	it("keeps an active owner out of autofill and rejects a stale direct store", () => {
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
				const source = before.items.find(({ id }) => id === workerOwnerItemId);
				if (source === undefined) {
					return yield* Effect.die(new Error("Expected the active source item."));
				}
				const availability = yield* readItemDetailMaterialAutofillAvailabilityFx({
					ownerItemId: upgradeOwnerItemId,
					runtime: before,
					selector: {
						type: "item",
						itemId: workerItemId,
					},
				});
				const autofill = yield* autofillLineInputsFx({
					ownerItemId: upgradeOwnerItemId,
					lineId: upgradeLineId,
				});
				const stored = yield* Effect.result(
					storeInputMaterialFx({
						ownerItemId: upgradeOwnerItemId,
						lineId: upgradeLineId,
						inputIndex: 0,
						sourceItemId: source.id,
						sourceItemRevision: source.revision,
						quantity: 1,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					autofill,
					availability,
					before,
					stored,
				};
			}).pipe(
				useGameFx({
					config,
					state: activeState,
				}),
			),
		);

		expect(result.availability.availableQuantity).toBe(0);
		expect(result.autofill).toEqual({
			deliveryItemIds: [],
			remainingMissingQuantity: 1,
			scheduledQuantity: 0,
		});
		expect(Result.isFailure(result.stored)).toBe(true);
		if (Result.isFailure(result.stored)) {
			expect(result.stored.failure).toMatchObject({
				_tag: "InputMaterialUnavailableError",
				sourceItemId: workerOwnerItemId,
			});
		}
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
