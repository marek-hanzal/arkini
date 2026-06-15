import { Effect } from "effect";
import { readActivationInputRowsFx } from "~/activation/fx/readActivationInputRowsFx";
import { spendActivationInputFx } from "~/activation/fx/spendActivationInputFx";
import { activationLabel } from "~/activation/logic/activationLabel";
import { groupActivationInputRows } from "~/activation/logic/groupActivationInputRows";
import { ActivateItemInputSchema } from "~/activation/type/ActivateItemInputSchema";
import type { ActivationResultSchema } from "~/activation/type/ActivationResultSchema";
import { createInitialBoardState } from "~/board/logic/createInitialBoardState";
import { readBoardState } from "~/board/logic/readBoardState";
import type { BoardItemState } from "~/board/view/BoardItemStateSchema";
import { GameActionError } from "~/command/GameActionError";
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
import { toGameActionError } from "~/play/logic/toGameActionError";
import { json } from "~/shared/json";
import { applyProducerUpgradeEffects } from "~/upgrade/logic/applyProducerUpgradeEffects";
import type { Command } from "~/command/Command";
import type { CommandResult } from "~/command/CommandResult";
import type { CommandVisualEventSchema } from "~/command/CommandVisualEventSchema";
import { depleteActivationFx } from "./depleteActivationFx";
import { rollActivationOutputFx } from "./rollActivationOutputFx";

export namespace activateFx {
	export interface Props {
		boardItemId: string;
		activation?: "single" | "exhaust";
	}
}

/**
 * GPT:FIX
 * This is too long, too complicated. Separate individual usecases and make the thing much less magical
 */
export const activateFx = Effect.fn("activateFx")(function* (props: activateFx.Props) {
	const input = yield* Effect.try({
		try: () =>
        /**
         * GPT:FIX
         * You're in an async func, you can parseAsync - fix this in other places if exists
         */
			ActivateItemInputSchema.parse({
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
			const timestampMs = now.toMillis();
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
				(date.parseTimestampMs(activationState.cooldownUntil) ?? 0) > timestampMs
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
			const inputRows = yield* readActivationInputRowsFx({
				ownerItemInstanceIds: [
					row.id,
				],
			});
			const storedInputs =
				groupActivationInputRows(inputRows).get(row.id) ?? new Map<ItemId, number>();

			for (const requirement of activation.requirements ?? []) {
				const stored = storedInputs.get(requirement.itemId) ?? 0;
				if (stored < requirement.quantity) {
					const name = gameConfig.getItem(requirement.itemId)?.name ?? requirement.itemId;
					return yield* Effect.fail(
						new GameActionError(
							`${activationLabel(activation.type)} requires ${name}.`,
						),
					);
				}
			}

			for (const required of activation.inputs ?? []) {
				const needed = required.quantity * steps;
				const stored = storedInputs.get(required.itemId) ?? 0;
				if (stored < needed) {
					const name = gameConfig.getItem(required.itemId)?.name ?? required.itemId;
					return yield* Effect.fail(
						new GameActionError(`${activationLabel(activation.type)} needs ${name}.`),
					);
				}
			}

			const allDrops: ItemId[] = [];
			for (let step = 0; step < steps; step++) {
				allDrops.push(
					...(yield* rollActivationOutputFx({
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

			for (const required of activation.inputs ?? []) {
				yield* spendActivationInputFx({
					ownerItemInstanceId: row.id,
					itemId: required.itemId,
					quantity: required.quantity * steps,
				});
			}
			const nextRemainingCharges =
				activation.type === "stash"
					? Math.max(0, (activationState.remainingCharges ?? activation.charges) - steps)
					: undefined;
			const shouldDeplete =
				activation.type === "stash" &&
				nextRemainingCharges !== undefined &&
				nextRemainingCharges <= 0;

			const visualEvents: CommandVisualEventSchema.Type[] = [
				{
					type: "activation.activated",
					itemInstanceId: row.id,
					mode: input.activation,
				},
				...placements.flatMap((placement): CommandVisualEventSchema.Type[] => {
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
								reason: "activation-output",
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
							reason: "activation-output",
						},
					];
				}),
			];

			if (shouldDeplete) {
				const depletion = yield* depleteActivationFx({
					row,
					stash: activation,
				});
				const activationResult = {
					activationBoardItemId: row.id,
					placements,
					depletion,
				} satisfies ActivationResultSchema.Type;

				return {
					activation: activationResult,
					visualEvents: [
						...visualEvents,
						{
							type: "activation.depleted",
							itemInstanceId: row.id,
							depletion,
						},
					],
				} satisfies CommandResult<
					Extract<
						Command,
						{
							type: "activation.activate";
						}
					>
				>;
			}

			yield* dbFx((db) =>
				db
					.updateTable(table.itemInstance)
					.set({
						stateJson: json({
							...state,
							activation: {
								...activationState,
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

			const activationResult = {
				activationBoardItemId: row.id,
				placements,
			} satisfies ActivationResultSchema.Type;

			return {
				activation: activationResult,
				visualEvents,
			} satisfies CommandResult<
				Extract<
					Command,
					{
						type: "activation.activate";
					}
				>
			>;
		}),
	);
});
