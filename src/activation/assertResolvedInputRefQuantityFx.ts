import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { GameEngineError } from "~/engine/model/GameEngineError";

export namespace assertResolvedInputRefQuantityFx {
	export interface Props {
		expectedQuantity: number;
		inputRef: GameActionResolvedInputRef;
		message: string;
	}
}

export const assertResolvedInputRefQuantityFx = Effect.fn("assertResolvedInputRefQuantityFx")(
	function* ({ expectedQuantity, inputRef, message }: assertResolvedInputRefQuantityFx.Props) {
		if (inputRef.quantity === expectedQuantity) return;

		return yield* Effect.fail(GameEngineError.actionRejected("input_mismatch", message));
	},
);
