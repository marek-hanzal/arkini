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
import type { CommandResultSchema } from "~/command/CommandResultSchema";
import type { CommandVisualEventSchema } from "~/command/CommandVisualEventSchema";

export namespace withdrawInputFx {
	export interface Props {
		boardItemId: string;
		itemId: string;
	}
}

export const withdrawInputFx = Effect.fn("withdrawInputFx")(function* (
	props: withdrawInputFx.Props,
) {
	const input = yield* Effect.tryPromise({
		try: () => WithdrawActivationInputSchema.parseAsync(props),
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

			const placements = yield* applyPlacementPlanFx({
				plan,
			});
			yield* spendActivationInputFx({
				ownerItemInstanceId: row.id,
				itemId: input.itemId,
				quantity: 1,
			});

			return {
				visualEvents: placements.flatMap((placement): CommandVisualEventSchema.Type[] => {
					if (placement.kind === "board") {
						if (
							!placement.boardItemId ||
							placement.x === undefined ||
							placement.y === undefined
						) {
							return [];
						}

						return [
							{
								type: "item.spawned",
								itemInstanceId: placement.boardItemId,
								itemId: placement.itemId,
								originItemInstanceId: row.id,
								to: {
									kind: "board",
									x: placement.x,
									y: placement.y,
								},
								reason: "activation-withdrawal",
							},
						];
					}

					if (placement.slotIndex === undefined) return [];

					return [
						{
							type: "item.spawned",
							itemId: placement.itemId,
							originItemInstanceId: row.id,
							to: {
								kind: "inventory",
								slotIndex: placement.slotIndex,
							},
							reason: "activation-withdrawal",
						},
					];
				}),
			} satisfies CommandResultSchema.Type;
		}),
	);
});
