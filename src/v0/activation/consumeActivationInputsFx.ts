import { Effect } from "effect";
import { checkActivationInputsFx } from "~/activation/checkActivationInputsFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";
import { consumeResolvedInputRefFx } from "~/activation/consumeResolvedInputRefFx";
import type { GameActivationInput } from "~/activation/GameActivationInput";
import type { GameActionItemRefSchema } from "~/action/GameActionItemRefSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace consumeActivationInputsFx {
	export interface Props {
		save: GameSave;
		inputs: readonly GameActivationInput[];
		inputRefs: readonly GameActionItemRefSchema.Type[];
		nowMs: number;
		reason: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>["reason"];
	}
}

export const consumeActivationInputsFx = Effect.fn("consumeActivationInputsFx")(function* ({
	save,
	inputs,
	inputRefs,
	nowMs,
	reason,
}: consumeActivationInputsFx.Props) {
	const checked = yield* checkActivationInputsFx({
		inputRefs,
		inputs,
		save,
	});
	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];

	for (const ref of checked.resolvedRefs) {
		if (!checked.consumedItemIds.has(ref.itemId)) {
			continue;
		}

		yield* consumeResolvedInputRefFx({
			events,
			nextSave,
			reason,
			ref,
		});
	}

	nextSave.updatedAtMs = nowMs;

	return {
		events,
		save: nextSave,
	};
});
