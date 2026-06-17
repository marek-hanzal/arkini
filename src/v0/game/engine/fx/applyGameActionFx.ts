import { Effect, type Effect as EffectType } from "effect";
import { GameConfigFx } from "~/v0/game/engine/context/GameConfigFx";
import { buildGameConfigServiceFx } from "~/v0/game/engine/fx/buildGameConfigServiceFx";
import { match } from "ts-pattern";
import { mergeItemFx } from "~/v0/game/engine/fx/mergeItemFx";
import { openStashFx } from "~/v0/game/engine/fx/openStashFx";
import { parseGameActionFx } from "~/v0/game/engine/fx/parseGameActionFx";
import { removeTileFx } from "~/v0/game/engine/fx/removeTileFx";
import { startCraftFx } from "~/v0/game/engine/fx/startCraftFx";
import { startProducerProductFx } from "~/v0/game/engine/fx/startProducerProductFx";
import { startUpgradeFx } from "~/v0/game/engine/fx/startUpgradeFx";
import { storeStoredRequirementFx } from "~/v0/game/engine/fx/storeStoredRequirementFx";
import { withdrawStoredRequirementFx } from "~/v0/game/engine/fx/withdrawStoredRequirementFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { RandomServiceFx } from "~/v0/random/context/RandomServiceFx";

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
	const gameConfig = yield* buildGameConfigServiceFx({
		config,
		save,
	});

	const result: EffectType.Effect<
		GameEngineResult,
		GameEngineError,
		GameConfigFx | RandomServiceFx
	> = match(parsedAction)
		.with(
			{
				type: "craft.start",
			},
			(craftAction) =>
				startCraftFx({
					action: craftAction,
					config: gameConfig.config,
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
					config: gameConfig.config,
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
					config: gameConfig.config,
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
					config: gameConfig.config,
					nowMs,
					save,
				}),
		)
		.with(
			{
				type: "stored_requirement.store",
			},
			(storeAction) =>
				storeStoredRequirementFx({
					action: storeAction,
					config: gameConfig.config,
					nowMs,
					save,
				}),
		)
		.with(
			{
				type: "stored_requirement.withdraw",
			},
			(withdrawAction) =>
				withdrawStoredRequirementFx({
					action: withdrawAction,
					config: gameConfig.config,
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
					config: gameConfig.config,
					nowMs,
					save,
				}),
		)
		.with(
			{
				type: "upgrade.start",
			},
			(upgradeAction) =>
				startUpgradeFx({
					action: upgradeAction,
					config: gameConfig.config,
					nowMs,
					save,
				}),
		)
		.exhaustive();

	return yield* Effect.provideService(result, GameConfigFx, gameConfig);
});
