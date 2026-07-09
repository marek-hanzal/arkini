import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineCompletionResult } from "~/engine/model/GameEngineCompletionResult";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import type { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";
import type { Effect } from "effect";

export type ProducerJobCompletionProps = {
	config: GameConfig;
	save: GameSave;
	job: GameSaveProducerJob;
	nowMs: number;
};

export type ProducerDeliveryItem = {
	itemId: string;
	quantity: number;
};

export type ProducerPlacementSuccess = Effect.Effect.Success<
	ReturnType<typeof placeGameSaveItemsFx>
>;

export type ProducerPlacementFailure = Extract<
	Effect.Effect.Error<ReturnType<typeof placeGameSaveItemsFx>>,
	{
		_tag: "GamePlacementFailed";
	}
>;

export type ProducerJobCompletionResult = GameEngineCompletionResult;
