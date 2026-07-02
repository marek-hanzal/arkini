import { Effect } from "effect";
import { GameConfigFx } from "~/v0/game/config/GameConfigFx";
import { readProductLineDefinitionFromConfig } from "~/v0/game/config/GameItemCapabilities";
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
	const product = readProductLineDefinitionFromConfig({
		config: gameConfig.config,
		productId,
	});
	if (!product) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing producer line "${productId}".`),
		);
	}

	return product;
});
