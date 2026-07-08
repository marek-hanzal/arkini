import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave, GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { rollEffectiveLootPlanItemsFx } from "~/effects/rollEffectiveLootPlanItemsFx";
import { readProducerJobEffectiveLineFx } from "~/producer/readProducerJobEffectiveLineFx";

export const rollProducerDeliveryItemsFx = Effect.fn("rollProducerDeliveryItemsFx")(function* ({
	config,
	job,
	nowMs,
	save,
}: {
	config: GameConfig;
	job: GameSaveProducerJob;
	nowMs: number;
	save: GameSave;
}) {
	const effectiveLine = yield* readProducerJobEffectiveLineFx({
		config,
		nowMs,
		itemInstanceId: job.itemInstanceId,
		lineId: job.lineId,
		save,
	});
	return (yield* rollEffectiveLootPlanItemsFx({
		lootPlan: effectiveLine.lootPlan,
	})).items;
});
