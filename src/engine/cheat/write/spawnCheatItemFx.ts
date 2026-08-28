import { Effect } from "effect";

import { CheatItemNotSpawnableError } from "~/engine/cheat/error/CheatItemNotSpawnableError";
import { CheatModeDisabledError } from "~/engine/cheat/error/CheatModeDisabledError";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { applyPlacementPlanFx } from "~/engine/placement/fx/applyPlacementPlanFx";
import { assertPlacementMaxCountFx } from "~/engine/placement/fx/assertPlacementMaxCountFx";
import { assertPlacementPlanCompleteFx } from "~/engine/placement/fx/assertPlacementPlanCompleteFx";
import { planBoardPlacementFx } from "~/engine/placement/fx/planBoardPlacementFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { StorageSchema } from "~/engine/scope/schema/StorageSchema";
import { PlacementSchema } from "~/engine/placement/schema/PlacementSchema";
import { PlacementFailureReasonEnumSchema } from "~/engine/placement/schema/PlacementFailureReasonEnumSchema";

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
				reason: PlacementFailureReasonEnumSchema.enum.BoardFull,
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
