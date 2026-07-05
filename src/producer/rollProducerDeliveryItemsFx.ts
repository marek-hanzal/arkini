import { Effect } from "effect";
import type { GameSaveProducerJob } from "~/engine/model/GameSaveSchema";
import { rollEffectiveLootPlanItemsFx } from "~/effects/rollEffectiveLootPlanItemsFx";
import { readProducerJobEffectiveLineFx } from "~/producer/readProducerJobEffectiveLineFx";
import type { ProducerJobCompletionScope } from "~/producer/ProducerJobCompletionTypes";

export const rollProducerDeliveryItemsFx = Effect.fn("rollProducerDeliveryItemsFx")(function* ({
	job,
	scope,
}: {
	job: GameSaveProducerJob;
	scope: ProducerJobCompletionScope;
}) {
	const { config, nowMs, save } = scope;
	const effectiveLine = yield* readProducerJobEffectiveLineFx({
		config,
		nowMs,
		itemInstanceId: job.itemInstanceId,
		lineId: job.lineId,
		save,
	});
	return (yield* rollEffectiveLootPlanItemsFx({
		config,
		lootPlan: effectiveLine.lootPlan,
	})).items;
});
