import { Effect } from "effect";
import { readActivationInputRowsFx } from "~/activation/fx/readActivationInputRowsFx";
import { spendActivationInputFx } from "~/activation/fx/spendActivationInputFx";
import { GameActionError } from "~/command/GameActionError";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { planPlacements } from "~/inventory/logic/planning/placement";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import { applyPlacementPlanFx } from "~/play/fx/applyPlacementPlanFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { WithdrawActivationInputSchema } from "~/activation/type/WithdrawActivationInputSchema";

export namespace withdrawInputFx {
	export interface Props {
		boardItemId: string;
		itemId: string;
	}
}

export const withdrawInputFx = Effect.fn("withdrawInputFx")(function* (
	props: withdrawInputFx.Props,
) {
	const input = yield* Effect.try({
		try: () => WithdrawActivationInputSchema.parse(props),
		catch: toGameActionError,
	});

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const gameConfig = yield* GameConfigServiceFx;
			const id = yield* IdServiceFx;
			const mutable = yield* readMutableSaveFx();
			const row = mutable.boardRows.find((entry) => entry.id === input.boardItemId);
			if (!row) {
				return yield* Effect.fail(new GameActionError("Board item does not exist."));
			}

			const activation = gameConfig.getActivation(row.itemDefinitionId);
			if (!activation) {
				return yield* Effect.fail(new GameActionError("This item cannot store inputs."));
			}

			const inputRows = yield* readActivationInputRowsFx({
				ownerItemInstanceIds: [
					row.id,
				],
			});
			const stored = inputRows
				.filter((entry) => entry.itemDefinitionId === input.itemId)
				.reduce((sum, entry) => sum + entry.quantity, 0);
			if (stored <= 0) {
				return yield* Effect.fail(new GameActionError("No stored input to withdraw."));
			}

			const plan = planPlacements(
				mutable.save,
				mutable.boardRows,
				mutable.inventoryRows,
				[
					input.itemId,
				],
				{
					gameConfig,
					id,
					origin: row,
				},
			);
			if (!plan) {
				return yield* Effect.fail(new GameActionError("Board and inventory are full."));
			}

			yield* applyPlacementPlanFx({
				plan,
			});
			yield* spendActivationInputFx({
				ownerItemInstanceId: row.id,
				itemId: input.itemId,
				quantity: 1,
			});
		}),
	);
});
