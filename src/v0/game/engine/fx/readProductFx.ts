import { Effect } from "effect";
import { GameConfigFx } from "~/v0/game/engine/context/GameConfigFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";

export namespace readProductFx {
	export interface Props {
		productId: string;
	}
}

export const readProductFx = Effect.fn("readProductFx")(function* ({
	productId,
}: readProductFx.Props) {
	const gameConfig = yield* GameConfigFx;
	const product = gameConfig.config.products[productId];
	if (!product) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing product "${productId}".`),
		);
	}

	return product;
});
