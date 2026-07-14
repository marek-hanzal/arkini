import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import { applyPlacementPlanFx } from "~/v1/placement/fx/applyPlacementPlanFx";
import { readAvailableStackItemsFx } from "~/v1/placement/fx/readAvailableStackItemsFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { purityTestConfig } from "~test/line/support/purityTestConfig";

const board = (x: number) => ({
	scope: "board" as const,
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
	it("excludes active and queued owners while retaining idle compatible stacks", () => {
		const active = craft({
			id: "runtime:active",
			location: board(0),
		});
		const queued = craft({
			id: "runtime:queued",
			location: board(1),
		});
		const idle = craft({
			id: "runtime:idle",
			location: board(2),
		});
		const runtime = {
			items: [
				active,
				queued,
				idle,
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
		} satisfies RuntimeSchema.Type;

		const stacks = Effect.runSync(
			readAvailableStackItemsFx({
				itemId: "craft",
				runtime,
				scope: "board",
			}),
		);

		expect(stacks.map((item) => item.id)).toEqual([
			idle.id,
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
			items: [
				active,
				idle,
			],
			jobs: [
				activeJob(active.id),
			],
		} satisfies RuntimeSchema.Type;

		const stacks = Effect.runSync(
			readAvailableStackItemsFx({
				itemId: "craft",
				runtime,
				scope: "inventory",
			}),
		);

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
			items: [
				origin,
				active,
			],
			jobs: [
				activeJob(active.id),
			],
		} satisfies RuntimeSchema.Type;

		const [placement, nextRuntime] = Effect.runSync(
			applyOutputPlacementFx({
				origin: origin.location.position,
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

	it("rejects a stale placement plan that targets a stateful item", () => {
		const active = craft({
			id: "runtime:active",
			location: board(0),
		});
		const runtime = {
			items: [
				active,
			],
			jobs: [
				activeJob(active.id),
			],
		} satisfies RuntimeSchema.Type;

		const result = Effect.runSync(
			Effect.either(
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

		expect(Either.isLeft(result)).toBe(true);
		if (Either.isLeft(result)) {
			expect(result.left).toMatchObject({
				_tag: "ItemStatefulError",
				itemId: active.id,
			});
		}
	});
});
