import { Effect } from "effect";
import { readActivationInputRowsFx } from "~/v0/activation/fx/readActivationInputRowsFx";
import { spendActivationInputFx } from "~/v0/activation/fx/spendActivationInputFx";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { withTransactionFx } from "~/v0/database/fx/withTransactionFx";
import { IdServiceFx } from "~/v0/id/context/IdServiceFx";
import { planPlacements } from "~/v0/inventory/logic/planning/placement";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import { applyPlacementPlanFx } from "~/v0/placement/fx/applyPlacementPlanFx";
import { readMutableSaveFx } from "~/v0/play/fx/readMutableSaveFx";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import { WithdrawActivationInputSchema } from "~/v0/activation/type/WithdrawActivationInputSchema";
import type { ActionResultSchema } from "~/v0/play/action/ActionResultSchema";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";

export namespace withdrawActivationInputFx {
	export interface Props {
		boardItemId: string;
		itemId: string;
	}
}

export const withdrawActivationInputFx = Effect.fn("withdrawActivationInputFx")(function* (
	props: withdrawActivationInputFx.Props,
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
				visualEvents: placements.flatMap((placement): ActionVisualEventSchema.Type[] => {
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
							itemInstanceId: placement.itemInstanceId,
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
			} satisfies ActionResultSchema.Type;
		}),
	);
});
