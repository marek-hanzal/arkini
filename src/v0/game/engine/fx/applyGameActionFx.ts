import { Effect } from "effect";
import { match } from "ts-pattern";
import { parseGameActionFx } from "~/v0/game/engine/fx/parseGameActionFx";
import { startProducerProductFx } from "~/v0/game/engine/fx/startProducerProductFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace applyGameActionFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: unknown;
		nowMs: number;
	}
}

export const applyGameActionFx = Effect.fn("applyGameActionFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: applyGameActionFx.Props) {
	const parsedAction = yield* parseGameActionFx({
		action,
	});

	return yield* match(parsedAction)
		.with(
			{
				type: "producer.product.start",
			},
			(startAction) =>
				startProducerProductFx({
					action: startAction,
					config,
					nowMs,
					save,
				}),
		)
		.exhaustive();
});
