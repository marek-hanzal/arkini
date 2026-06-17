import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { countPassiveItemQuantityFx } from "~/v0/game/engine/fx/countPassiveItemQuantityFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameRequirement } from "~/v0/game/engine/model/GameRequirement";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkGameRequirementsFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		requirements: readonly GameRequirement[];
	}
}

export const checkGameRequirementsFx = Effect.fn("checkGameRequirementsFx")(function* ({
	config,
	save,
	requirements,
}: checkGameRequirementsFx.Props) {
	for (const requirement of requirements) {
		yield* match(requirement)
			.with(
				{
					type: "passive",
				},
				(passiveRequirement) =>
					Effect.gen(function* () {
						const availableQuantity = yield* countPassiveItemQuantityFx({
							itemId: passiveRequirement.itemId,
							save,
							scope: passiveRequirement.scope,
						});
						if (availableQuantity < passiveRequirement.quantity) {
							return yield* Effect.fail(
								GameEngineError.actionRejected(
									"missing_requirement",
									`Missing passive requirement "${passiveRequirement.itemId}" (${availableQuantity}/${passiveRequirement.quantity}).`,
								),
							);
						}
					}),
			)
			.with(
				{
					type: "stored",
				},
				(storedRequirement) =>
					Effect.fail(
						GameEngineError.actionRejected(
							"unsupported_requirement",
							`Stored requirement "${storedRequirement.itemId}" needs save storage before the new engine can evaluate it.`,
						),
					),
			)
			.exhaustive();
	}

	void config;
});
