import { Effect } from "effect";

import { areGridLocationsWithinBoundsFx } from "~/engine/location/read/areGridLocationsWithinBoundsFx";
import { isItemLocationScopeAllowedFx } from "~/engine/location/read/isItemLocationScopeAllowedFx";
import { readGridItemDestinationFx } from "~/engine/location/read/readGridItemDestinationFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { DropDestinationExpectationError } from "~/engine/runtime/error/DropDestinationExpectationError";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import { doDropCollisionExpectationsMatchFx } from "./doDropCollisionExpectationsMatchFx";

export namespace assertDropDestinationExpectationFx {
	export interface Props {
		readonly allowAdditionalOccupants: boolean;
		readonly expectedCollisions: ReadonlyArray<{
			readonly itemId: string;
			readonly revision: string;
		}>;
		readonly explicitTargetItemId: string;
		readonly location: GridLocationSchema.Type;
		readonly runtime: RuntimeSchema.Type;
		readonly source: GridRuntimeItemSchema.Type;
	}
}

/** Rechecks one previewed destination against the latest serialized runtime snapshot. */
export const assertDropDestinationExpectationFx = Effect.fn("assertDropDestinationExpectationFx")(
	function* ({
		allowAdditionalOccupants,
		expectedCollisions,
		explicitTargetItemId,
		location,
		runtime,
		source,
	}: assertDropDestinationExpectationFx.Props) {
		if (
			!(yield* isItemLocationScopeAllowedFx({
				item: source.item,
				locationScope: location.scope,
			}))
		) {
			return yield* Effect.fail(
				new DropDestinationExpectationError({
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
				}),
			);
		}
		const destination = yield* readGridItemDestinationFx({
			excludedItemIds: new Set([
				source.id,
			]),
			item: source.item,
			location,
			runtime,
		});
		if (
			!(yield* areGridLocationsWithinBoundsFx({
				locations: destination.locations,
				scope: location.scope,
			}))
		) {
			return yield* Effect.fail(
				new DropDestinationExpectationError({
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
				}),
			);
		}
		if (destination.claims.some((claim) => claim.kind === "delivery-origin")) {
			return yield* Effect.fail(
				new DropDestinationExpectationError({
					reason: DropItemRejectedReasonEnumSchema.enum.Occupied,
				}),
			);
		}
		const actualCollisions = destination.claims.map((claim) => {
			const item = runtime.items.find((candidate) => candidate.id === claim.itemId);
			return item === undefined
				? undefined
				: {
						itemId: item.id,
						revision: item.revision,
					};
		});
		if (
			actualCollisions.some((collision) => collision === undefined) ||
			!(yield* doDropCollisionExpectationsMatchFx({
				left: expectedCollisions,
				right: actualCollisions.filter((collision) => collision !== undefined),
			})) ||
			!actualCollisions.some((collision) => collision?.itemId === explicitTargetItemId)
		) {
			return yield* Effect.fail(
				new DropDestinationExpectationError({
					reason: DropItemRejectedReasonEnumSchema.enum.StaleTarget,
				}),
			);
		}
		if (
			!allowAdditionalOccupants &&
			actualCollisions.some((collision) => collision?.itemId !== explicitTargetItemId)
		) {
			return yield* Effect.fail(
				new DropDestinationExpectationError({
					reason: DropItemRejectedReasonEnumSchema.enum.Occupied,
				}),
			);
		}
	},
);
