import { Effect } from "effect";
import type { GameActivationInput } from "~/activation/GameActivationInput";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { consumeResolvedInputRefFx } from "~/activation/consumeResolvedInputRefFx";
import { planLineAutoFillInputRefsFx } from "~/producer/planLineAutoFillInputRefsFx";
import { storeProducerResolvedInputFx } from "~/producer/storeProducerResolvedInputFx";
import { resolveInputRefsFx } from "~/activation/resolveInputRefsFx";

export namespace autoFillLineInputsFx {
	export interface Props {
		events: GameEvent[];
		inputs: readonly GameActivationInput[];
		nextSave: GameSave;
		nowMs: number;
		itemInstanceId: string;
		lineId: string;
	}
}

export const autoFillLineInputsFx = Effect.fn("autoFillLineInputsFx")(function* ({
	events,
	inputs,
	nextSave,
	nowMs,
	itemInstanceId,
	lineId,
}: autoFillLineInputsFx.Props) {
	const inputRefs = yield* planLineAutoFillInputRefsFx({
		inputs,
		itemInstanceId,
		lineId,
		save: nextSave,
	});
	const resolvedRefs = yield* resolveInputRefsFx({
		inputRefs,
		save: nextSave,
	});

	for (const ref of resolvedRefs) {
		yield* consumeResolvedInputRefFx({
			events,
			nextSave,
			reason: "producer-input-auto-fill",
			ref,
		});
		yield* storeProducerResolvedInputFx({
			events,
			nextSave,
			nowMs,
			itemInstanceId,
			lineId,
			ref,
		});
	}
});
