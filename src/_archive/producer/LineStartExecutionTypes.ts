import type { Effect } from "effect";
import type { GameActionLineStartSchema } from "~/action/GameActionLineStartSchema";
import type { GameActivationInput } from "~/activation/GameActivationInput";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { checkLineStartReadinessFx } from "~/producer/checkLineStartReadinessFx";

export interface LineStartExecutionProps {
	config: GameConfig;
	save: GameSave;
	action: GameActionLineStartSchema.Type;
	nowMs: number;
}

export type LineStartReadiness = Effect.Effect.Success<
	ReturnType<typeof checkLineStartReadinessFx>
>;

export type LineStartConsumedInputRefs = {
	events: GameEvent[];
	save: GameSave;
};

export type LineStartPreparedInputs = {
	events: GameEvent[];
	nextSave: GameSave;
	ready: boolean;
};

export type LineStartedState = {
	events: GameEvent[];
	nextSave: GameSave;
};

export type ActivatedLineEffect = {
	effectId: string;
	endAtMs: number;
	id: string;
	producerJobId: string;
	sourceItemInstanceId: string;
	startAtMs: number;
};

export type ProducerStoredInputsReadyProps = {
	inputs: readonly GameActivationInput[];
	save: GameSave;
	itemInstanceId: string;
	lineId: string;
};
