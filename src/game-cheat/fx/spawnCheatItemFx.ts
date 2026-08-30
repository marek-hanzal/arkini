import { Effect } from "effect";

import { CheatItemNotSpawnableError } from "~/game-cheat/error/CheatItemNotSpawnableError";
import { CheatModeDisabledError } from "~/game-cheat/error/CheatModeDisabledError";
import type { IdSchema } from "~/game-config/schema/IdSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { applyPlacementPlanFx } from "~/item-placement/fx/applyPlacementPlanFx";
import { assertPlacementMaxCountFx } from "~/item-placement/fx/assertPlacementMaxCountFx";
import { assertPlacementPlanCompleteFx } from "~/item-placement/fx/assertPlacementPlanCompleteFx";
import { planBoardPlacementFx } from "~/item-placement/fx/planBoardPlacementFx";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";

export namespace spawnCheatItemFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
	}
}

/** Authorizes and atomically places one ordinary item through canonical Board placement. */
export const spawnCheatItemFx = Effect.fn("spawnCheatItemFx")(function* ({
	itemId,
}: spawnCheatItemFx.Props) {
	const config = yield* GameConfigFx;
	const item = yield* resolveItemFx({
		itemId,
	});
	if (item.scope !== StorageSchema.enum.Board && item.scope !== StorageSchema.enum.Any) {
		return yield* Effect.fail(
			new CheatItemNotSpawnableError({
				itemId,
			}),
		);
	}
	const drop = {
		itemId,
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
			yield* assertPlacementMaxCountFx({
				drop,
				item,
				runtime,
			});
			const plan = yield* planBoardPlacementFx({
				item,
				origin: {
					scope: LocationScopeEnumSchema.enum.Board,
					space: runtime.currentSpace,
					position: {
						x: Math.floor(config.meta.board.width / 2),
						y: Math.floor(config.meta.board.height / 2),
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
			const [result, nextRuntime] = yield* applyPlacementPlanFx({
				plan,
				runtime,
			});
			return [
				result,
				nextRuntime,
			] as const;
		}),
	);
});
