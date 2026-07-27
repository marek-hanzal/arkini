import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DropItemRejectedReasonEnumSchema as DropItemRejectedReason } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";

const dropHarness = vi.hoisted(() => ({
	callCount: 0,
	firstRejection: null as DropItemRejectedReason.Type | null,
}));

vi.mock("~/engine/runtime/write/dropItemFx", async (importOriginal) => {
	const actual = await importOriginal<typeof import("~/engine/runtime/write/dropItemFx")>();
	const { Effect } = await import("effect");
	const { reviseRuntimeItemFx } = await import("~/engine/runtime/fx/reviseRuntimeItemFx");
	const { modifyRuntimeFx } = await import("~/engine/runtime/internal/modifyRuntimeFx");
	const { DropItemRejectedReasonEnumSchema } = await import(
		"~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema"
	);

	return {
		...actual,
		dropItemFx: ((props: Parameters<typeof actual.dropItemFx>[0]) => {
			dropHarness.callCount += 1;
			const rejection = dropHarness.firstRejection;
			dropHarness.firstRejection = null;
			if (rejection !== null) {
				return Effect.gen(function* () {
					const targetItemId =
						props.target.kind === "slot" && props.target.occupant !== null
							? props.target.occupant.itemId
							: null;
					const revisedItemId =
						rejection === DropItemRejectedReasonEnumSchema.enum.StaleSource
							? props.sourceItemId
							: targetItemId;
					if (revisedItemId === null) {
						return yield* Effect.die(
							"Stale-target harness requires an occupied target.",
						);
					}
					yield* modifyRuntimeFx((runtime) =>
						Effect.gen(function* () {
							const current = runtime.items.find((item) => item.id === revisedItemId);
							if (current === undefined) {
								return yield* Effect.die(
									`Conflict harness item "${revisedItemId}" is missing.`,
								);
							}
							const revised = yield* reviseRuntimeItemFx({
								item:
									rejection === DropItemRejectedReasonEnumSchema.enum.StaleSource
										? {
												...current,
												quantity: current.quantity + 1,
											}
										: current,
							});
							return [
								undefined,
								{
									...runtime,
									items: runtime.items.map((item) =>
										item.id === revised.id ? revised : item,
									),
								},
							] as const;
						}),
					).pipe(Effect.orDie);
					return {
						kind: "reject",
						reason: rejection,
						itemId: props.sourceItemId,
						...(targetItemId === null
							? {}
							: {
									targetItemId,
								}),
					} as const;
				});
			}
			return actual.dropItemFx(props);
		}) satisfies typeof actual.dropItemFx,
	};
});

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

const ownerItemId = "runtime:workshop";
const lineId = "line:workshop:build";

beforeEach(() => {
	dropHarness.callCount = 0;
	dropHarness.firstRejection = null;
});

describe("autofillLineInputsFx conflicts", () => {
	it.each([
		{
			expectedSourceQuantity: 5,
			firstRejection: DropItemRejectedReasonEnumSchema.enum.StaleSource,
		},
		{
			expectedSourceQuantity: 4,
			firstRejection: DropItemRejectedReasonEnumSchema.enum.StaleTarget,
		},
	])("replans after one optimistic $firstRejection conflict", async ({
		expectedSourceQuantity,
		firstRejection,
	}) => {
		dropHarness.firstRejection = firstRejection;

		const result = await Effect.runPromise(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: ownerItemId,
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:stack",
					itemId: "water",
					location: sourceLocation(1),
					quantity: 7,
				});

				const autofill = yield* autofillLineInputsFx({
					ownerItemId,
					lineId,
				});
				return {
					autofill,
					runtime: yield* readRuntimeFx(),
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.autofill).toEqual({
			storedQuantity: 3,
			remainingMissingQuantity: 0,
		});
		expect(dropHarness.callCount).toBe(2);
		expect(result.runtime.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "runtime:stack",
					quantity: expectedSourceQuantity,
				}),
			]),
		);
	});
});
