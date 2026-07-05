import type { Effect } from "effect";
import type { GameActionLineStartSchema } from "~/action/GameActionLineStartSchema";
import type { GameConfig } from "~/config/GameConfigTypes";
import { readLineDefinition } from "~/config/GameItemCapabilities";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readProducerRuntimeTargetFx } from "~/producer/readProducerRuntimeTargetFx";

export interface LineStartReadinessScope {
	config: GameConfig;
	nowMs?: number;
	save: GameSave;
	action: GameActionLineStartSchema.Type;
}

export type LineStartTarget = Effect.Effect.Success<ReturnType<typeof readProducerRuntimeTargetFx>>;

export type LineStartSelection = LineStartTarget & {
	lineId: string;
	visibleLineIds: readonly string[];
};

export type LineStartDefinition = LineStartSelection & {
	line: NonNullable<ReturnType<typeof readLineDefinition>>;
	lineInputs: NonNullable<NonNullable<ReturnType<typeof readLineDefinition>>["inputs"]>;
};
