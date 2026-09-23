import { readBoardSizeFn } from "~/game-runtime/fn/readBoardSizeFn";
import { Effect } from "effect";

import { CheatModeDisabledError } from "~/game-cheat/error/CheatModeDisabledError";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";
import { applyPlacementPlanFn } from "~/item-placement/fn/applyPlacementPlanFn";
import { assertPlacementPlanCompleteFx } from "~/item-placement/fx/assertPlacementPlanCompleteFx";
import { planBoardPlacementFx } from "~/item-placement/fx/planBoardPlacementFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";

export namespace spawnCheatItemFx {
	export interface Props {
		readonly itemUid: IdSchema.Type;
	}
}

/** Authorizes and atomically places one ordinary item through canonical Board placement. */
export const spawnCheatItemFx = Effect.fn("spawnCheatItemFx")(function* ({
	itemUid,
}: spawnCheatItemFx.Props) {
	const config = yield* GameConfigFx;
	const item = yield* resolveItemFx({
		itemUid,
	});
	const drop = {
		type: "item" as const,
		itemUid,
		placement: PlacementSchema.enum.Drop,
		quantity: 1 as const,
	};

	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			if (!runtime.cheats.enabled) {
				return yield* Effect.fail(
					new CheatModeDisabledError({
						command: "spawn-item",
					}),
				);
			}
			const size = readBoardSizeFn({
				runtime,
				config,
				space: runtime.currentSpace,
			});
			const plan = yield* planBoardPlacementFx({
				item,
				origin: {
					scope: LocationScopeEnumSchema.enum.Board,
					space: runtime.currentSpace,
					position: {
						x: Math.floor(size.width / 2),
						y: Math.floor(size.height / 2),
					},
				},
				placement: PlacementSchema.enum.Drop,
				quantity: 1,
				runtime,
			});
			yield* assertPlacementPlanCompleteFx({
				drop,
				plan,
				quantity: 1,
				reason: PlacementUnavailableError.Reason.BoardFull,
			});
			const nextRuntime = applyPlacementPlanFn({
				plan,
				runtime,
			});
			return [
				plan,
				nextRuntime,
			] as const;
		}),
	);
});
