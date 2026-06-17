import { Effect } from "effect";
import { GameActionSchema } from "~/v0/game/engine/model/GameActionSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";

export namespace parseGameActionFx {
	export interface Props {
		action: unknown;
	}
}

export const parseGameActionFx = Effect.fn("parseGameActionFx")(function* ({
	action,
}: parseGameActionFx.Props) {
	const result = GameActionSchema.safeParse(action);
	if (!result.success) {
		return yield* Effect.fail(
			GameEngineError.actionInvalid(
				result.error.issues.map((issue) => issue.message).join("; "),
			),
		);
	}
	return result.data;
});
