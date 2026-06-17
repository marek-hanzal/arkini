import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkActivationInputsFx } from "~/v0/game/engine/fx/checkActivationInputsFx";
import { checkGameRequirementsFx } from "~/v0/game/engine/fx/checkGameRequirementsFx";
import { readProducerBoardItemFx } from "~/v0/game/engine/fx/readProducerBoardItemFx";
import { readProductFx } from "~/v0/game/engine/fx/readProductFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionProducerProductStart } from "~/v0/game/engine/model/GameActionProducerProductStart";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkProducerProductStartReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionProducerProductStart;
	}
}

export const checkProducerProductStartReadinessFx = Effect.fn(
	"checkProducerProductStartReadinessFx",
)(function* ({ config, save, action }: checkProducerProductStartReadinessFx.Props) {
	const producerItem = yield* readProducerBoardItemFx({
		config,
		producerItemInstanceId: action.producerItemInstanceId,
		save,
	});
	const producerDefinition =
		config.producers[config.items[producerItem.itemId]?.producerId ?? ""];
	if (!producerDefinition) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Producer item "${producerItem.itemId}" references missing producer.`,
			),
		);
	}
	if (!producerDefinition.productIds.includes(action.productId)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Product "${action.productId}" does not belong to producer "${producerDefinition.type}" on item "${producerItem.itemId}".`,
			),
		);
	}

	const product = yield* readProductFx({
		productId: action.productId,
	});

	yield* checkGameRequirementsFx({
		config,
		requirements: producerDefinition.requirements,
		save,
	});
	yield* checkGameRequirementsFx({
		config,
		requirements: product.requirements,
		save,
	});
	yield* match(product.placement)
		.with("board_then_inventory", () => Effect.void)
		.exhaustive();
	yield* checkActivationInputsFx({
		inputRefs: action.inputRefs,
		inputs: product.inputs,
		save,
	});

	return {
		producerDefinition,
		producerItem,
		product,
	};
});
