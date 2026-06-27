import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { rollEffectiveLootPlanItemsFx } from "~/v0/game/effects/rollEffectiveLootPlanItemsFx";
import { readProducerJobEffectiveProductLineFx } from "~/v0/game/producer/readProducerJobEffectiveProductLineFx";

export namespace rollProducerJobSnapshotFx {
	export interface Props {
		config: GameConfig;
		ignoredProducerJobIds?: ReadonlySet<string>;
		producerItemInstanceId: string;
		productId: string;
		save: GameSave;
		startAtMs: number;
	}

	export interface Result {
		outputItems: GameSaveProducerJob["outputItems"];
		placement: GameSaveProducerJob["placement"];
		readyAtMs: number;
		startAtMs: number;
	}
}

export const rollProducerJobSnapshotFx = Effect.fn("rollProducerJobSnapshotFx")(function* ({
	config,
	ignoredProducerJobIds,
	producerItemInstanceId,
	productId,
	save,
	startAtMs,
}: rollProducerJobSnapshotFx.Props) {
	const product = config.products[productId];
	const effectiveProductLine = yield* readProducerJobEffectiveProductLineFx({
		config,
		ignoredProducerJobIds,
		nowMs: startAtMs,
		producerItemInstanceId,
		productId,
		save,
	});
	const outputItems = (yield* rollEffectiveLootPlanItemsFx({
		config,
		lootPlan: effectiveProductLine.lootPlan,
	})).items;

	return {
		outputItems,
		placement: product!.placement,
		readyAtMs: startAtMs + effectiveProductLine.durationMs,
		startAtMs,
	} satisfies rollProducerJobSnapshotFx.Result;
});
