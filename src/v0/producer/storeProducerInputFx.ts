import { Effect } from "effect";
import { consumeResolvedInputRefFx } from "~/activation/consumeResolvedInputRefFx";
import type { GameActionProducerInputStoreSchema } from "~/action/GameActionProducerInputStoreSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { createGameEngineResultFx } from "~/job/createGameEngineResultFx";
import { checkProducerInputStoreReadinessFx } from "~/producer/checkProducerInputStoreReadinessFx";
import { storeProducerResolvedInputFx } from "~/producer/storeProducerResolvedInputFx";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace storeProducerInputFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerInputStoreSchema.Type;
		nowMs: number;
	}
}

type ProducerInputStoreReadiness = Effect.Effect.Success<
	ReturnType<typeof checkProducerInputStoreReadinessFx>
>;

type ProducerInputStoreWorkingState = {
	checked: ProducerInputStoreReadiness;
	events: GameEvent[];
	nextSave: GameSave;
};

const readProducerInputStoreReadinessFx = Effect.fn(
	"storeProducerInputFx.readProducerInputStoreReadinessFx",
)(function* ({ action, config, nowMs, save }: storeProducerInputFx.Props) {
	return yield* checkProducerInputStoreReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
});

const createStoredProducerInputWorkingStateFx = Effect.fn(
	"storeProducerInputFx.createStoredProducerInputWorkingStateFx",
)(function* ({
	checked,
	props,
}: {
	checked: ProducerInputStoreReadiness;
	props: storeProducerInputFx.Props;
}) {
	const nextSave = yield* cloneGameSaveFx({
		save: props.save,
	});
	const events: GameEvent[] = [];

	yield* consumeResolvedInputRefFx({
		events,
		nextSave,
		reason: "producer-input-store",
		ref: checked.resolvedRef,
	});
	yield* storeProducerResolvedInputFx({
		events,
		itemInstanceId: props.action.itemInstanceId,
		lineId: checked.lineId,
		nextSave,
		nowMs: props.nowMs,
		ref: checked.resolvedRef,
	});
	nextSave.updatedAtMs = props.nowMs;

	return {
		checked,
		events,
		nextSave,
	} satisfies ProducerInputStoreWorkingState;
});

const buildStoredProducerInputResultFx = Effect.fn(
	"storeProducerInputFx.buildStoredProducerInputResultFx",
)(function* ({
	events,
	nextSave,
	props,
}: ProducerInputStoreWorkingState & {
	props: storeProducerInputFx.Props;
}) {
	return yield* createGameEngineResultFx({
		config: props.config,
		events,
		nowMs: props.nowMs,
		save: nextSave,
	});
});

const storeProducerInputProgramFx = Effect.fn("storeProducerInputFx.storeProducerInputProgramFx")(
	function* (props: storeProducerInputFx.Props) {
		const checked = yield* readProducerInputStoreReadinessFx(props);
		const state = yield* createStoredProducerInputWorkingStateFx({
			checked,
			props,
		});
		return yield* buildStoredProducerInputResultFx({
			...state,
			props,
		});
	},
);

export const storeProducerInputFx = Effect.fn("storeProducerInputFx")(function* (
	props: storeProducerInputFx.Props,
) {
	return yield* storeProducerInputProgramFx(props);
});
