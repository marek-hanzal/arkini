import { Effect } from "effect";
import type { GameActionInventorySlotsSwapSchema } from "~/action/GameActionInventorySlotsSwapSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace checkInventorySlotsSwapReadinessFx {
	export interface Props {
		action: GameActionInventorySlotsSwapSchema.Type;
		save: GameSave;
	}
}

export const checkInventorySlotsSwapReadinessFx = Effect.fn("checkInventorySlotsSwapReadinessFx")(
	function* ({ action, save }: checkInventorySlotsSwapReadinessFx.Props) {
		if (
			action.sourceSlotIndex >= save.inventory.slots.length ||
			action.targetSlotIndex >= save.inventory.slots.length
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"unsupported_target",
					"Inventory slot is outside inventory.",
				),
			);
		}
	},
);
