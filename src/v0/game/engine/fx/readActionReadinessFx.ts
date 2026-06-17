import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkCraftStartReadinessFx } from "~/v0/game/engine/fx/checkCraftStartReadinessFx";
import { checkItemMergeReadinessFx } from "~/v0/game/engine/fx/checkItemMergeReadinessFx";
import { checkProducerProductStartReadinessFx } from "~/v0/game/engine/fx/checkProducerProductStartReadinessFx";
import { checkStashOpenReadinessFx } from "~/v0/game/engine/fx/checkStashOpenReadinessFx";
import { checkTileRemoveReadinessFx } from "~/v0/game/engine/fx/checkTileRemoveReadinessFx";
import { parseGameActionFx } from "~/v0/game/engine/fx/parseGameActionFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionReadiness } from "~/v0/game/engine/model/GameActionReadinessSchema";
import type { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace readActionReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: unknown;
	}
}

export const readActionReadinessFx = Effect.fn("readActionReadinessFx")(function* ({
	config,
	save,
	action,
}: readActionReadinessFx.Props) {
	const readinessEffect = Effect.gen(function* () {
		const parsedAction = yield* parseGameActionFx({
			action,
		});
		yield* match(parsedAction)
			.with(
				{
					type: "craft.start",
				},
				(craftAction) =>
					checkCraftStartReadinessFx({
						action: craftAction,
						config,
						save,
					}),
			)
			.with(
				{
					type: "item.merge",
				},
				(mergeAction) =>
					checkItemMergeReadinessFx({
						action: mergeAction,
						config,
						save,
					}),
			)
			.with(
				{
					type: "producer.product.start",
				},
				(startAction) =>
					checkProducerProductStartReadinessFx({
						action: startAction,
						config,
						save,
					}),
			)
			.with(
				{
					type: "stash.open",
				},
				(openAction) =>
					checkStashOpenReadinessFx({
						action: openAction,
						config,
						save,
					}),
			)
			.with(
				{
					type: "tile.remove",
				},
				(removeAction) =>
					checkTileRemoveReadinessFx({
						action: removeAction,
						config,
						save,
					}),
			)
			.exhaustive();
	});

	return yield* readinessEffect.pipe(
		Effect.match({
			onFailure: (error: GameEngineError) =>
				({
					errorTag: error._tag,
					message: error.message,
					...(error._tag === "GameActionRejected"
						? {
								reason: error.reason,
							}
						: {}),
					type: "rejected" as const,
				}) satisfies GameActionReadiness,
			onSuccess: () =>
				({
					type: "ready" as const,
				}) satisfies GameActionReadiness,
		}),
	);
});
