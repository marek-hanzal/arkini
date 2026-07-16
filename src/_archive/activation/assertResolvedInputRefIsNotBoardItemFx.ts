import { Effect } from "effect";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { GameEngineError } from "~/engine/model/GameEngineError";

export namespace assertResolvedInputRefIsNotBoardItemFx {
	export interface Props {
		inputRef: GameActionResolvedInputRef;
		message: string;
		targetItemInstanceId: string;
	}
}

export const assertResolvedInputRefIsNotBoardItemFx = Effect.fn(
	"assertResolvedInputRefIsNotBoardItemFx",
)(function* ({
	inputRef,
	message,
	targetItemInstanceId,
}: assertResolvedInputRefIsNotBoardItemFx.Props) {
	if (inputRef.kind !== "board" || inputRef.itemInstanceId !== targetItemInstanceId) return;

	return yield* Effect.fail(GameEngineError.actionRejected("invalid_actor", message));
});
