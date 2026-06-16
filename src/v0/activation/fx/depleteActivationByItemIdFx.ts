import { Effect } from "effect";
import { depleteActivationFx } from "~/v0/activation/fx/depleteActivationFx";
import type { ActivationDepletionSchema } from "~/v0/activation/type/ActivationDepletionSchema";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { readMutableSaveFx } from "~/v0/play/fx/readMutableSaveFx";
import { withTransactionFx } from "~/v0/database/fx/withTransactionFx";

export namespace depleteActivationByItemIdFx {
	export interface Props {
		boardItemId: string;
	}
}

export const depleteActivationByItemIdFx = Effect.fn("depleteActivationByItemIdFx")(function* ({
	boardItemId,
}: depleteActivationByItemIdFx.Props) {
	return yield* withTransactionFx(
		Effect.gen(function* () {
			const gameConfig = yield* GameConfigServiceFx;
			const mutable = yield* readMutableSaveFx();
			const row = mutable.boardRows.find((entry) => entry.id === boardItemId);
			if (!row) {
				return undefined satisfies ActivationDepletionSchema.Type | undefined;
			}

			const activation = gameConfig.getActivation(row.itemDefinitionId);
			if (!activation || activation.type !== "stash") {
				return yield* Effect.fail(
					new GameActionError("Only depleted stashes can be finalized."),
				);
			}

			return yield* depleteActivationFx({
				row,
				stash: activation,
			});
		}),
	);
});
