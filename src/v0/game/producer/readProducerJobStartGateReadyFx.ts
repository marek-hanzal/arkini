import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { readWorldProducerJobSubjectFx } from "~/v0/game/world/readWorldProducerJobSubjectFx";

export namespace readProducerJobStartGateReadyFx {
	export interface Props {
		config: GameConfig;
		evaluateAtMs: number;
		ignoredProducerJobIds?: ReadonlySet<string>;
		job: GameSaveProducerJob;
		save: GameSave;
	}
}

export const readProducerJobStartGateReadyFx = Effect.fn("readProducerJobStartGateReadyFx")(
	function* ({
		config,
		evaluateAtMs,
		ignoredProducerJobIds,
		job,
		save,
	}: readProducerJobStartGateReadyFx.Props) {
		const subject = yield* readWorldProducerJobSubjectFx({
			config,
			job,
			save,
		});
		const effectiveProductLine = readEffectiveProducerProductLine({
			baseDurationMs: readProducerProductDurationMs({
				product: subject.product,
			}),
			config,
			ignoredProducerJobIds,
			nowMs: evaluateAtMs,
			producerId: subject.producerItem.itemId,
			producerItemId: subject.producerItem.itemId,
			producerItemInstanceId: job.producerItemInstanceId,
			product: subject.product,
			productId: job.productId,
			save,
		});

		return (
			effectiveProductLine.visible &&
			effectiveProductLine.grantsReady !== false &&
			!effectiveProductLine.blocked
		);
	},
);
