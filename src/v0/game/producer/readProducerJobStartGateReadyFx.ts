import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readEffectiveProducerProductLine } from "~/v0/game/effects/readEffectiveProducerProductLine";
import { readProducerJobRequirementsReadyFx } from "~/v0/game/producer/readProducerJobRequirementsReadyFx";
import { readProducerProductDurationMs } from "~/v0/game/producer/readProducerProductDurationMs";
import { resolveGameRequirements } from "~/v0/game/requirements/resolveGameRequirements";

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
		const requirementsReady = yield* readProducerJobRequirementsReadyFx({
			config,
			job,
			save,
		});
		if (!requirementsReady) return false;

		const producerItem = save.board.items[job.producerItemInstanceId];
		if (!producerItem) {
			return yield* Effect.fail(
				GameEngineError.saveInvalid(
					`Producer job target "${job.producerItemInstanceId}" must be a board item.`,
				),
			);
		}

		const producerDefinition = config.producers[producerItem.itemId];
		if (!producerDefinition) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(
					`Missing producer definition "${producerItem.itemId}".`,
				),
			);
		}

		const product = config.products[job.productId];
		if (!product) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing product "${job.productId}".`),
			);
		}

		const producerRequirements = resolveGameRequirements({
			config,
			requirementIds: producerDefinition.requirementIds,
		});
		const productRequirements = resolveGameRequirements({
			config,
			requirementIds: product.requirementIds,
		});
		const requirements = [
			...producerRequirements,
			...productRequirements,
		];
		const hindrances = [
			...(producerDefinition.hinderedBy ?? []),
			...(product.hinderedBy ?? []),
		];
		const effectiveProductLine = readEffectiveProducerProductLine({
			baseDurationMs: readProducerProductDurationMs({
				hindrances,
				product,
				producerItemInstanceId: job.producerItemInstanceId,
				requirements,
				save,
			}),
			config,
			ignoredProducerJobIds,
			nowMs: evaluateAtMs,
			producerId: producerItem.itemId,
			producerItemId: producerItem.itemId,
			producerItemInstanceId: job.producerItemInstanceId,
			product,
			productId: job.productId,
			save,
		});

		return effectiveProductLine.visible && !effectiveProductLine.blocked;
	},
);
