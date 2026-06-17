import { Effect } from "effect";
import { match } from "ts-pattern";
import { mergeItemFx } from "~/v0/game/engine/fx/mergeItemFx";
import { openStashFx } from "~/v0/game/engine/fx/openStashFx";
import { parseGameActionFx } from "~/v0/game/engine/fx/parseGameActionFx";
import { removeTileFx } from "~/v0/game/engine/fx/removeTileFx";
import { startCraftFx } from "~/v0/game/engine/fx/startCraftFx";
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
				type: "craft.start",
			},
			(craftAction) =>
				startCraftFx({
					action: craftAction,
					config,
					nowMs,
					save,
				}),
		)
		.with(
			{
				type: "item.merge",
			},
			(mergeAction) =>
				mergeItemFx({
					action: mergeAction,
					config,
					nowMs,
					save,
				}),
		)
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
		.with(
			{
				type: "stash.open",
			},
			(openAction) =>
				openStashFx({
					action: openAction,
					config,
					nowMs,
					save,
				}),
		)
		.with(
			{
				type: "tile.remove",
			},
			(removeAction) =>
				removeTileFx({
					action: removeAction,
					config,
					nowMs,
					save,
				}),
		)
		.exhaustive();
});
