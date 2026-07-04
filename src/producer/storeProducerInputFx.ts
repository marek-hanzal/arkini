import { Context, Effect } from "effect";
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

class StoreProducerInputScopeFx extends Context.Tag("StoreProducerInputScopeFx")<
	StoreProducerInputScopeFx,
	storeProducerInputFx.Props
>() {
	//
}

const readProducerInputStoreReadinessFx = Effect.fn(
	"storeProducerInputFx.readProducerInputStoreReadinessFx",
)(function* () {
	const { action, config, nowMs, save } = yield* StoreProducerInputScopeFx;
	return yield* checkProducerInputStoreReadinessFx({
		action,
		config,
		nowMs,
		save,
	});
});

const createStoredProducerInputWorkingStateFx = Effect.fn(
	"storeProducerInputFx.createStoredProducerInputWorkingStateFx",
)(function* ({ checked }: { checked: ProducerInputStoreReadiness }) {
	const { action, nowMs, save } = yield* StoreProducerInputScopeFx;
	const nextSave = yield* cloneGameSaveFx({
		save,
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
		itemInstanceId: action.itemInstanceId,
		lineId: checked.lineId,
		nextSave,
		nowMs,
		ref: checked.resolvedRef,
	});
	nextSave.updatedAtMs = nowMs;

	return {
		checked,
		events,
		nextSave,
	} satisfies ProducerInputStoreWorkingState;
});

const buildStoredProducerInputResultFx = Effect.fn(
	"storeProducerInputFx.buildStoredProducerInputResultFx",
)(function* ({ events, nextSave }: ProducerInputStoreWorkingState) {
	const { config, nowMs } = yield* StoreProducerInputScopeFx;
	return yield* createGameEngineResultFx({
		config,
		events,
		nowMs,
		save: nextSave,
	});
});

const storeProducerInputProgramFx = Effect.fn("storeProducerInputFx.storeProducerInputProgramFx")(
	function* () {
		const checked = yield* readProducerInputStoreReadinessFx();
		const state = yield* createStoredProducerInputWorkingStateFx({
			checked,
		});
		return yield* buildStoredProducerInputResultFx(state);
	},
);

export const storeProducerInputFx = Effect.fn("storeProducerInputFx")(function* ({
	action,
	config,
	nowMs,
	save,
}: storeProducerInputFx.Props) {
	return yield* storeProducerInputProgramFx().pipe(
		Effect.provideService(StoreProducerInputScopeFx, {
			action,
			config,
			nowMs,
			save,
		}),
	);
});
