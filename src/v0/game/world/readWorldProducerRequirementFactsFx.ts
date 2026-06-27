import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import { resolveGameRequirements } from "~/v0/game/requirements/resolveGameRequirements";
import { readWorldRequirementFactsFx } from "~/v0/game/world/readWorldRequirementFactsFx";
import type { WorldProducerRequirementFacts } from "~/v0/game/world/WorldProducerRequirementFacts";

export namespace readWorldProducerRequirementFactsFx {
	export interface Props {
		config: GameConfig;
		job: GameSaveProducerJob;
		save: GameSave;
	}
}

export const readWorldProducerRequirementFactsFx = Effect.fn("readWorldProducerRequirementFactsFx")(
	function* ({ config, job, save }: readWorldProducerRequirementFactsFx.Props) {
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

		const requirements = resolveGameRequirements({
			config,
			requirementIds: [
				...producerDefinition.requirementIds,
				...product.requirementIds,
			],
		});
		const storedItems = yield* readStoredRequirementQuantitiesFx({
			save,
			targetItemInstanceId: job.producerItemInstanceId,
		});
		const requirementFacts = yield* readWorldRequirementFactsFx({
			requirements,
			save,
			storedItems,
			targetItemInstanceId: job.producerItemInstanceId,
		});

		return {
			jobId: job.id,
			producerItemInstanceId: job.producerItemInstanceId,
			ready: requirementFacts.every((fact) => fact.status === "ok"),
			requirements: requirementFacts,
		} satisfies WorldProducerRequirementFacts;
	},
);
