import { Effect } from "effect";
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

const createWorldSnapshotProcessingStateFx = Effect.fn(
	"processWorldSnapshotFx.createWorldSnapshotProcessingStateFx",
)(function* ({ save }: { save: GameSave }) {
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
)(function* ({
	config,
	nowMs,
	state,
}: Pick<processWorldSnapshotFx.Props, "config" | "nowMs"> & {
	state: WorldSnapshotProcessingState;
}) {
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
	config,
	nowMs,
	state,
}: Pick<processWorldSnapshotFx.Props, "config" | "nowMs"> & {
	state: WorldSnapshotProcessingState;
}) {
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
	config,
	nowMs,
	state,
}: Pick<processWorldSnapshotFx.Props, "config" | "nowMs"> & {
	state: WorldSnapshotProcessingState;
}) {
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
	function* ({
		config,
		nowMs,
		state,
	}: Pick<processWorldSnapshotFx.Props, "config" | "nowMs"> & {
		state: WorldSnapshotProcessingState;
	}) {
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
)(function* ({
	config,
	nowMs,
	state,
}: Pick<processWorldSnapshotFx.Props, "config" | "nowMs"> & {
	state: WorldSnapshotProcessingState;
}) {
	yield* processProducerJobsFx({
		config,
		nowMs,
		state,
	});
	yield* processCraftJobsFx({
		config,
		nowMs,
		state,
	});
	yield* processProducerJobsFx({
		config,
		nowMs,
		state,
	});
});

const readProcessedWorldWakePlanFx = Effect.fn(
	"processWorldSnapshotFx.readProcessedWorldWakePlanFx",
)(function* ({
	config,
	nowMs,
	state,
}: Pick<processWorldSnapshotFx.Props, "config" | "nowMs"> & {
	state: WorldSnapshotProcessingState;
}) {
	return yield* readWorldWakePlanFx({
		config,
		nowMs,
		save: state.nextSave,
	});
});

const processWorldSnapshotProgramFx = Effect.fn(
	"processWorldSnapshotFx.processWorldSnapshotProgramFx",
)(function* ({ config, nowMs, save }: processWorldSnapshotFx.Props) {
	const state = yield* createWorldSnapshotProcessingStateFx({
		save,
	});
	yield* processItemSpawnJobsBeforeRuntimeJobsFx({
		config,
		nowMs,
		state,
	});
	yield* processRuntimeJobsUntilStableFx({
		config,
		nowMs,
		state,
	});
	yield* processExpiredEffectsFx({
		config,
		nowMs,
		state,
	});
	const wakePlan = yield* readProcessedWorldWakePlanFx({
		config,
		nowMs,
		state,
	});

	return {
		events: state.events,
		nextWakeAtMs: wakePlan.nextWakeAtMs,
		save: state.nextSave,
	} satisfies processWorldSnapshotFx.Result;
});

export const processWorldSnapshotFx = Effect.fn("processWorldSnapshotFx")(function* (
	props: processWorldSnapshotFx.Props,
) {
	return yield* processWorldSnapshotProgramFx(props);
});
