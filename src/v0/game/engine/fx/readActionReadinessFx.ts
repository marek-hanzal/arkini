import { Effect } from "effect";
import { GameConfigFx } from "~/v0/game/engine/context/GameConfigFx";
import { buildGameConfigServiceFx } from "~/v0/game/engine/fx/buildGameConfigServiceFx";
import { match } from "ts-pattern";
import { checkCraftStartReadinessFx } from "~/v0/game/engine/fx/checkCraftStartReadinessFx";
import { checkItemMergeReadinessFx } from "~/v0/game/engine/fx/checkItemMergeReadinessFx";
import { checkProducerProductLineSetEnabledReadinessFx } from "~/v0/game/engine/fx/checkProducerProductLineSetEnabledReadinessFx";
import { checkProducerProductStartReadinessFx } from "~/v0/game/engine/fx/checkProducerProductStartReadinessFx";
import { checkStashOpenReadinessFx } from "~/v0/game/engine/fx/checkStashOpenReadinessFx";
import { checkStoredRequirementStoreReadinessFx } from "~/v0/game/engine/fx/checkStoredRequirementStoreReadinessFx";
import { checkStoredRequirementWithdrawReadinessFx } from "~/v0/game/engine/fx/checkStoredRequirementWithdrawReadinessFx";
import { checkTileRemoveReadinessFx } from "~/v0/game/engine/fx/checkTileRemoveReadinessFx";
import { checkUpgradeStartReadinessFx } from "~/v0/game/engine/fx/checkUpgradeStartReadinessFx";
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
	const gameConfig = yield* buildGameConfigServiceFx({
		config,
		save,
	});
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
						config: gameConfig.config,
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
						config: gameConfig.config,
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
						config: gameConfig.config,
						save,
					}),
			)
			.with(
				{
					type: "producer.product_line.set_enabled",
				},
				(setEnabledAction) =>
					checkProducerProductLineSetEnabledReadinessFx({
						action: setEnabledAction,
						config: gameConfig.config,
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
						config: gameConfig.config,
						save,
					}),
			)
			.with(
				{
					type: "stored_requirement.store",
				},
				(storeAction) =>
					checkStoredRequirementStoreReadinessFx({
						action: storeAction,
						config: gameConfig.config,
						save,
					}),
			)
			.with(
				{
					type: "stored_requirement.withdraw",
				},
				(withdrawAction) =>
					checkStoredRequirementWithdrawReadinessFx({
						action: withdrawAction,
						config: gameConfig.config,
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
						config: gameConfig.config,
						save,
					}),
			)
			.with(
				{
					type: "upgrade.start",
				},
				(upgradeAction) =>
					checkUpgradeStartReadinessFx({
						action: upgradeAction,
						config: gameConfig.config,
						save,
					}),
			)
			.exhaustive();
	});

	return yield* Effect.provideService(readinessEffect, GameConfigFx, gameConfig).pipe(
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
