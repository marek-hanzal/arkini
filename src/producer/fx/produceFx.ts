import { Effect } from "effect";
import { createInitialBoardState } from "~/board/logic/createInitialBoardState";
import { readBoardState } from "~/board/logic/readBoardState";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { planPlacements } from "~/inventory/logic/planning/placement";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/manifestId";
import { applyPlacementPlanFx } from "~/play/fx/applyPlacementPlanFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { ProduceBoardItemInputSchema } from "~/play/schema/ProduceBoardItemInputSchema";
import type { BoardItemState } from "~/board/view/BoardItemStateSchema";
import type { ProducerDropResult } from "~/producer/type/ProducerDropResultSchema";
import { GameActionError } from "~/command/GameActionError";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { itemLabel } from "~/producer/logic/itemLabel";
import { json } from "~/shared/json";
import { applyProducerUpgradeEffects } from "~/upgrade/logic/applyProducerUpgradeEffects";
import { depleteFx } from "./depleteFx";
import { rollOutputFx } from "./rollOutputFx";

export namespace produceFx {
	export interface Props {
		boardItemId: string;
		activation?: "single" | "exhaust";
	}
}

export const produceFx = Effect.fn("produceFx")(function* (props: produceFx.Props) {
	const input = yield* Effect.try({
		try: () =>
			ProduceBoardItemInputSchema.parse({
				...props,
				activation: props.activation ?? "single",
			}),
		catch: toGameActionError,
	});

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const date = yield* DateServiceFx;
			const gameConfig = yield* GameConfigServiceFx;
			const id = yield* IdServiceFx;
			const now = date.now();
			const timestamp = now.toMillis();
			const updatedAt = date.toTimestamp(now);

			const mutable = yield* readMutableSaveFx();
			const row = mutable.boardRows.find((entry) => entry.id === input.boardItemId);
			if (!row) {
				return yield* Effect.fail(new GameActionError("Board item does not exist."));
			}

			const baseActivation = gameConfig.getActivation(row.itemDefinitionId);
			if (!baseActivation) {
				return yield* Effect.fail(new GameActionError("This item cannot be activated."));
			}
			const activation =
				baseActivation.type === "producer"
					? applyProducerUpgradeEffects({
							gameConfig,
							producerItemId: row.itemDefinitionId,
							producer: baseActivation,
							upgradeRows: mutable.upgradeRows,
						})
					: baseActivation;
			if (activation.trigger !== "click") {
				return yield* Effect.fail(new GameActionError("This item cannot be clicked."));
			}

			const lootTable = gameConfig.getLootTable(activation.outputTableId);
			if (!lootTable) {
				return yield* Effect.fail(
					new GameActionError(`Missing loot table ${activation.outputTableId}.`),
				);
			}

			const state = readBoardState(row);
			const activationState = {
				...(createInitialBoardState(row.itemDefinitionId, gameConfig).activation ?? {}),
				...(state.activation ?? {}),
			};
			const isExhaust = input.activation === "exhaust" && activation.type === "stash";

			if (
				activation.type === "producer" &&
				!isExhaust &&
				activationState.cooldownUntil &&
				(date.parseTimestampMs(activationState.cooldownUntil) ?? 0) > timestamp
			) {
				return yield* Effect.fail(new GameActionError("Producer is still cooling down."));
			}

			if (
				activationState.remainingCharges !== undefined &&
				activationState.remainingCharges <= 0
			) {
				return yield* Effect.fail(new GameActionError("This stash is empty."));
			}

			const steps = isExhaust
				? Math.max(1, activationState.remainingCharges ?? activation.charges)
				: 1;
			const storedInventory = {
				...(activationState.inventory ?? {}),
			};

			for (const required of activation.inputs ?? []) {
				const needed = required.quantity * steps;
				const stored = storedInventory[required.itemId] ?? 0;
				if (stored < needed) {
					const name = gameConfig.getItem(required.itemId)?.name ?? required.itemId;
					return yield* Effect.fail(
						new GameActionError(`${itemLabel(activation.type)} needs ${name}.`),
					);
				}
				storedInventory[required.itemId] = stored - needed;
				if (storedInventory[required.itemId] <= 0) delete storedInventory[required.itemId];
			}

			const allDrops: ItemId[] = [];
			for (let step = 0; step < steps; step++) {
				allDrops.push(
					...(yield* rollOutputFx({
						outputs: lootTable.output,
					})),
				);
			}

			const plan = planPlacements(
				mutable.save,
				mutable.boardRows,
				mutable.inventoryRows,
				allDrops,
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
			const nextRemainingCharges =
				activation.type === "stash"
					? Math.max(0, (activationState.remainingCharges ?? activation.charges) - steps)
					: undefined;
			const shouldDeplete =
				activation.type === "stash" &&
				nextRemainingCharges !== undefined &&
				nextRemainingCharges <= 0;

			if (shouldDeplete) {
				const depletion = yield* depleteFx({
					row,
					stash: activation,
				});
				return {
					producerBoardItemId: row.id,
					placements,
					depletion,
				} satisfies ProducerDropResult;
			}

			yield* dbFx((db) =>
				db
					.updateTable(table.itemInstance)
					.set({
						stateJson: json({
							...state,
							activation: {
								...activationState,
								inventory: storedInventory,
								cooldownUntil:
									activation.type === "producer"
										? date.toTimestamp(
												now.plus({
													milliseconds: activation.cooldownMs,
												}),
											)
										: undefined,
								remainingCharges: nextRemainingCharges,
							},
						} satisfies BoardItemState),
						updatedAt,
					})
					.where("id", "=", row.id)
					.execute(),
			);

			return {
				producerBoardItemId: row.id,
				placements,
			} satisfies ProducerDropResult;
		}),
	);
});
