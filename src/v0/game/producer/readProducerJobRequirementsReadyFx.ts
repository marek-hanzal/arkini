import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave, GameSaveProducerJob } from "~/v0/game/engine/model/GameSaveSchema";
import { checkGameRequirementsFx } from "~/v0/game/requirements/checkGameRequirementsFx";
import { readStoredRequirementQuantitiesFx } from "~/v0/game/requirements/readStoredRequirementQuantitiesFx";
import { resolveGameRequirements } from "~/v0/game/requirements/resolveGameRequirements";

export namespace readProducerJobRequirementsReadyFx {
	export interface Props {
		config: GameConfig;
		job: GameSaveProducerJob;
		save: GameSave;
	}
}

export const readProducerJobRequirementsReadyFx = Effect.fn("readProducerJobRequirementsReadyFx")(
	function* ({ config, job, save }: readProducerJobRequirementsReadyFx.Props) {
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
		const readiness = yield* Effect.either(
			checkGameRequirementsFx({
				requirements,
				save,
				storedItems,
				targetItemInstanceId: job.producerItemInstanceId,
			}),
		);

		return readiness._tag === "Right";
	},
);
