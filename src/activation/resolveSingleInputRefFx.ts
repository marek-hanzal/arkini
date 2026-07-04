import { Effect } from "effect";
import type { GameActionItemRefSchema } from "~/action/GameActionItemRefSchema";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { resolveInputRefsFx } from "~/activation/resolveInputRefsFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace resolveSingleInputRefFx {
	export interface Props {
		inputRef: GameActionItemRefSchema.Type;
		missingMessage: string;
		save: GameSave;
	}
}

export const resolveSingleInputRefFx = Effect.fn("resolveSingleInputRefFx")(function* ({
	inputRef,
	missingMessage,
	save,
}: resolveSingleInputRefFx.Props) {
	const [resolvedRef] = yield* resolveInputRefsFx({
		inputRefs: [
			inputRef,
		],
		save,
	});

	if (resolvedRef) return resolvedRef satisfies GameActionResolvedInputRef;

	return yield* Effect.fail(GameEngineError.actionRejected("input_unavailable", missingMessage));
});
