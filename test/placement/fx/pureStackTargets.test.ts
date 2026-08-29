import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import { applyPlacementPlanFx } from "~/engine/placement/fx/applyPlacementPlanFx";
import { readAvailableStackItemsFn } from "~/engine/placement/fn/readAvailableStackItemsFn";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { purityTestConfig } from "~test/line/support/purityTestConfig";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

const inventory = (x: number) => ({
	scope: "inventory" as const,
	position: {
		x,
		y: 0,
	},
});

const craft = ({
	id,
	location,
}: {
	id: string;
	location: ReturnType<typeof board> | ReturnType<typeof inventory>;
}) => ({
	id,
	item: purityTestConfig.items.craft,
	location,
	quantity: 1,
	revision: `revision:${id}`,
});

const activeJob = (ownerItemId: string) => ({
	id: `job:${ownerItemId}`,
	ownerItemId,
	lineId: "line:craft",
	durationMs: 1_000,
	remainingMs: 1_000,
	revision: `revision:job:${ownerItemId}`,
});

describe("pure placement stack targets", () => {
	it("excludes stateful owners and orders idle candidates by code unit", () => {
		const active = craft({
			id: "runtime:active",
			location: board(0),
		});
		const queued = craft({
			id: "runtime:queued",
			location: board(1),
		});
		const accentedIdle = craft({
			id: "runtime:é",
			location: board(2),
		});
		const asciiIdle = craft({
			id: "runtime:z",
			location: board(2),
		});
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				active,
				queued,
				accentedIdle,
				asciiIdle,
			],
			jobs: [
				activeJob(active.id),
			],
			jobQueue: [
				{
					id: "request:queued",
					ownerItemId: queued.id,
					lineId: "line:craft",
				},
			],

			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		const stacks = readAvailableStackItemsFn({
			itemId: "craft",
			locations: [
				board(0),
				board(1),
				board(2),
			],
			runtime,
		});

		expect(stacks.map((item) => item.id)).toEqual([
			asciiIdle.id,
			accentedIdle.id,
		]);
	});

	it("excludes a paused active owner in inventory", () => {
		const active = craft({
			id: "runtime:active",
			location: inventory(0),
		});
		const idle = craft({
			id: "runtime:idle",
			location: inventory(1),
		});
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				active,
				idle,
			],
			jobs: [
				activeJob(active.id),
			],

			jobQueue: [],
			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		const stacks = readAvailableStackItemsFn({
			itemId: "craft",
			locations: [
				inventory(0),
				inventory(1),
			],
			runtime,
		});

		expect(stacks.map((item) => item.id)).toEqual([
			idle.id,
		]);
	});

	it("uses standard output placement without stacking into an active owner", () => {
		const active = craft({
			id: "runtime:active",
			location: board(1),
		});
		const origin = {
			id: "runtime:origin",
			item: purityTestConfig.items.material,
			location: board(0),
			quantity: 1,
			revision: "revision:origin",
		};
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				origin,
				active,
			],
			jobs: [
				activeJob(active.id),
			],

			jobQueue: [],
			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		const [placement, nextRuntime] = Effect.runSync(
			applyOutputPlacementFx({
				origin: {
					scope: "board",
					space: 0,
					position: origin.location.position,
				},
				output: {
					drop: [
						{
							itemId: "craft",
							placement: "drop",
							quantity: 1,
						},
					],
				},
				runtime,
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(placement.drop[0]?.placement.stack).toEqual([]);
		expect(placement.drop[0]?.placement.spawn).toHaveLength(1);
		expect(nextRuntime.items.find((item) => item.id === active.id)?.quantity).toBe(1);
		expect(nextRuntime.items.filter((item) => item.item.id === "craft")).toHaveLength(2);
	});

	it("keeps excluded coordinates out of both standard stack and spawn candidates", () => {
		const excludedStack = {
			id: "runtime:excluded-stack",
			item: purityTestConfig.items.material,
			location: board(0),
			quantity: 2,
			revision: "revision:excluded-stack",
		};
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				excludedStack,
			],
			jobs: [],

			jobQueue: [],
			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		const [placement, nextRuntime] = Effect.runSync(
			applyOutputPlacementFx({
				excludedLocations: [
					board(0),
				],
				origin: board(0),
				output: {
					drop: [
						{
							itemId: "material",
							placement: "drop",
							quantity: 3,
						},
					],
				},
				runtime,
			}).pipe(
				useGameFx({
					config: purityTestConfig,
				}),
			),
		);

		expect(placement.drop[0]?.placement.stack).toEqual([]);
		expect(placement.drop[0]?.placement.spawn).toEqual([
			expect.objectContaining({
				location: board(1),
				quantity: 3,
			}),
		]);
		expect(nextRuntime.items.find((item) => item.id === excludedStack.id)?.quantity).toBe(2);
	});

	it("rejects a stale placement plan that targets a stateful item", () => {
		const active = craft({
			id: "runtime:active",
			location: board(0),
		});
		const runtime = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				active,
			],
			jobs: [
				activeJob(active.id),
			],

			jobQueue: [],
			defaultLineByOwnerItemId: {},
		} satisfies RuntimeSchema.Type;

		const result = Effect.runSync(
			Effect.result(
				applyPlacementPlanFx({
					plan: {
						remove: [],
						spawn: [],
						stack: [
							{
								itemId: active.id,
								quantity: 1,
							},
						],
					},
					runtime,
				}),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "ItemStatefulError",
				itemId: active.id,
			});
		}
	});
});
