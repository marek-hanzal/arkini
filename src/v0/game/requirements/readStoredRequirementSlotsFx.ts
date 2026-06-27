import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameRequirement } from "~/v0/game/requirements/GameRequirement";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProducerCapabilityDefinition } from "~/v0/game/config/readProducerCapabilityDefinition";
import { resolveGameRequirements } from "~/v0/game/requirements/resolveGameRequirements";

export namespace readStoredRequirementSlotsFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		targetItemInstanceId: string;
	}
}

export const readStoredRequirementSlotsFx = Effect.fn("readStoredRequirementSlotsFx")(function* ({
	config,
	save,
	targetItemInstanceId,
}: readStoredRequirementSlotsFx.Props) {
	const targetItem = save.board.items[targetItemInstanceId];
	if (!targetItem) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_target",
				`Stored requirement target "${targetItemInstanceId}" is not on the board.`,
			),
		);
	}

	const item = config.items[targetItem.itemId];
	if (!item) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing item "${targetItem.itemId}".`),
		);
	}

	const requirements: GameRequirement[] = [];

	const producer = readProducerCapabilityDefinition({
		config,
		producerId: targetItem.itemId,
	});
	if (producer) {
		requirements.push(
			...resolveGameRequirements({
				config,
				requirementIds: producer.requirementIds,
			}),
		);
		for (const productId of producer.productIds) {
			const product = config.products[productId];
			if (!product) {
				return yield* Effect.fail(
					GameEngineError.configReferenceMissing(
						`Producer-like capability "${targetItem.itemId}" references missing product "${productId}".`,
					),
				);
			}
			requirements.push(
				...resolveGameRequirements({
					config,
					requirementIds: product.requirementIds,
				}),
			);
		}
	}

	const recipe = config.craftRecipes[targetItem.itemId];
	if (recipe) {
		requirements.push(...recipe.requirements);
	}

	const storedRequirements = requirements.filter(
		(
			requirement,
		): requirement is Extract<
			GameRequirement,
			{
				type: "stored";
			}
		> => requirement.type === "stored",
	);

	if (storedRequirements.length === 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_requirement",
				`Target "${targetItemInstanceId}" has no stored requirement slots.`,
			),
		);
	}

	return {
		storedRequirements,
		targetItem,
	};
});
