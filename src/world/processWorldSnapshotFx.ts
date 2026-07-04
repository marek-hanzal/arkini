import { Context, Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { processCompletedCraftJobsFx } from "~/craft/processCompletedCraftJobsFx";
import { processExpiredActiveEffectsFx } from "~/effects/processExpiredActiveEffectsFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { processItemSpawnJobsFx } from "~/job/processItemSpawnJobsFx";
import { processCompletedProducerJobsFx } from "~/producer/processCompletedProducerJobsFx";
import { readWorldWakePlanFx } from "~/world/readWorldWakePlanFx";

export namespace processWorldSnapshotFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}

	export interface Result {
		events: GameEvent[];
		nextWakeAtMs: number | null;
		save: GameSave;
	}
}

type WorldProcessingStepResult = {
	events: GameEvent[];
	save: GameSave;
};

type WorldSnapshotProcessingState = {
	events: GameEvent[];
	nextSave: GameSave;
};

class WorldSnapshotProcessingScopeFx extends Context.Tag("WorldSnapshotProcessingScopeFx")<
	WorldSnapshotProcessingScopeFx,
	processWorldSnapshotFx.Props
>() {
	//
}

const createWorldSnapshotProcessingStateFx = Effect.fn(
	"processWorldSnapshotFx.createWorldSnapshotProcessingStateFx",
)(function* () {
	const { save } = yield* WorldSnapshotProcessingScopeFx;
	const state: WorldSnapshotProcessingState = {
		events: [],
		nextSave: save,
	};
	return state;
});

const appendWorldProcessingStepResultFx = Effect.fn(
	"processWorldSnapshotFx.appendWorldProcessingStepResultFx",
)(function* ({
	result,
	state,
}: {
	result: WorldProcessingStepResult;
	state: WorldSnapshotProcessingState;
}) {
	state.nextSave = result.save;
	state.events.push(...result.events);
});

const processItemSpawnJobsBeforeRuntimeJobsFx = Effect.fn(
	"processWorldSnapshotFx.processItemSpawnJobsBeforeRuntimeJobsFx",
)(function* (state: WorldSnapshotProcessingState) {
	const { config, nowMs } = yield* WorldSnapshotProcessingScopeFx;
	yield* appendWorldProcessingStepResultFx({
		result: yield* processItemSpawnJobsFx({
			config,
			nowMs,
			save: state.nextSave,
		}),
		state,
	});
});

const processProducerJobsFx = Effect.fn("processWorldSnapshotFx.processProducerJobsFx")(function* ({
	state,
}: {
	state: WorldSnapshotProcessingState;
}) {
	const { config, nowMs } = yield* WorldSnapshotProcessingScopeFx;
	yield* appendWorldProcessingStepResultFx({
		result: yield* processCompletedProducerJobsFx({
			config,
			nowMs,
			save: state.nextSave,
		}),
		state,
	});
});

const processCraftJobsFx = Effect.fn("processWorldSnapshotFx.processCraftJobsFx")(function* ({
	state,
}: {
	state: WorldSnapshotProcessingState;
}) {
	const { config, nowMs } = yield* WorldSnapshotProcessingScopeFx;
	yield* appendWorldProcessingStepResultFx({
		result: yield* processCompletedCraftJobsFx({
			config,
			nowMs,
			save: state.nextSave,
		}),
		state,
	});
});

const processExpiredEffectsFx = Effect.fn("processWorldSnapshotFx.processExpiredEffectsFx")(
	function* (state: WorldSnapshotProcessingState) {
		const { config, nowMs } = yield* WorldSnapshotProcessingScopeFx;
		yield* appendWorldProcessingStepResultFx({
			result: yield* processExpiredActiveEffectsFx({
				config,
				nowMs,
				save: state.nextSave,
			}),
			state,
		});
	},
);

const processRuntimeJobsUntilStableFx = Effect.fn(
	"processWorldSnapshotFx.processRuntimeJobsUntilStableFx",
)(function* (state: WorldSnapshotProcessingState) {
	yield* processProducerJobsFx({
		state,
	});
	yield* processCraftJobsFx({
		state,
	});
	yield* processProducerJobsFx({
		state,
	});
});

const readProcessedWorldWakePlanFx = Effect.fn(
	"processWorldSnapshotFx.readProcessedWorldWakePlanFx",
)(function* (state: WorldSnapshotProcessingState) {
	const { config, nowMs } = yield* WorldSnapshotProcessingScopeFx;
	return yield* readWorldWakePlanFx({
		config,
		nowMs,
		save: state.nextSave,
	});
});

const processWorldSnapshotProgramFx = Effect.fn(
	"processWorldSnapshotFx.processWorldSnapshotProgramFx",
)(function* () {
	const state = yield* createWorldSnapshotProcessingStateFx();
	yield* processItemSpawnJobsBeforeRuntimeJobsFx(state);
	yield* processRuntimeJobsUntilStableFx(state);
	yield* processExpiredEffectsFx(state);
	const wakePlan = yield* readProcessedWorldWakePlanFx(state);

	return {
		events: state.events,
		nextWakeAtMs: wakePlan.nextWakeAtMs,
		save: state.nextSave,
	} satisfies processWorldSnapshotFx.Result;
});

export const processWorldSnapshotFx = Effect.fn("processWorldSnapshotFx")(function* (
	props: processWorldSnapshotFx.Props,
) {
	return yield* processWorldSnapshotProgramFx().pipe(
		Effect.provideService(WorldSnapshotProcessingScopeFx, props),
	);
});
