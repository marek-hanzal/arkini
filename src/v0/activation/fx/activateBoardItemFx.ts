import { Effect } from "effect";
import type { ActionResultSchema } from "~/v0/play/action/ActionResultSchema";
import { readActivationInputRowsFx } from "~/v0/activation/fx/readActivationInputRowsFx";
import { spendActivationInputFx } from "~/v0/activation/fx/spendActivationInputFx";
import { groupActivationInputRows } from "~/v0/activation/logic/groupActivationInputRows";
import { ActivateItemInputSchema } from "~/v0/activation/type/ActivateItemInputSchema";
import type { ActivationResultSchema } from "~/v0/activation/type/ActivationResultSchema";
import { createInitialBoardState } from "~/v0/board/logic/createInitialBoardState";
import { readBoardState } from "~/v0/board/logic/readBoardState";
import type { BoardItemState } from "~/v0/board/view/BoardItemStateSchema";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { dbFx } from "~/v0/database/fx/dbFx";
import { withTransactionFx } from "~/v0/database/fx/withTransactionFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { IdServiceFx } from "~/v0/id/context/IdServiceFx";
import { planPlacements } from "~/v0/inventory/logic/planning/placement";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import type { ItemId } from "~/v0/manifest/manifestId";
import { applyPlacementPlanFx } from "~/v0/placement/fx/applyPlacementPlanFx";
import { readMutableSaveFx } from "~/v0/play/fx/readMutableSaveFx";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import { json } from "~/v0/serialization/json";
import { resolveActivationDepletion } from "~/v0/activation/logic/resolveActivationDepletion";
import { ActionVisualAnimation } from "~/v0/play/action/ActionVisualAnimation";
import { applyProducerUpgradeEffects } from "~/v0/upgrade/logic/applyProducerUpgradeEffects";
import { assertActivationStoredInputsFx } from "./assertActivationStoredInputsFx";
import { createActivationVisualEventsFx } from "./createActivationVisualEventsFx";
import { rollActivationOutputFx } from "./rollActivationOutputFx";

export namespace activateBoardItemFx {
	export interface Props {
		boardItemId: string;
		activation?: "single" | "exhaust";
	}
}

/**
 * Activates one board item and returns the command result plus visual facts.
 *
 * The effect deliberately keeps the mutation in one transaction, but the phases
 * are ordered as plain gameplay steps: validate target, resolve upgraded
 * activation definition, validate stored inputs, roll output, plan placements,
 * spend inputs, then update or deplete the source item.
 */
export const activateBoardItemFx = Effect.fn("activateBoardItemFx")(function* (
	props: activateBoardItemFx.Props,
) {
	const input = yield* Effect.tryPromise({
		try: () =>
			ActivateItemInputSchema.parseAsync({
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

			yield* assertActivationStoredInputsFx({
				activation,
				gameConfig,
				steps,
				storedInputs,
			});

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

			const visualEvents = yield* createActivationVisualEventsFx({
				mode: input.activation,
				placements,
				row,
			});

			if (shouldDeplete) {
				const depletion = resolveActivationDepletion(activation);
				yield* dbFx((db) =>
					db
						.updateTable("itemInstance")
						.set({
							stateJson: json({
								...state,
								activation: {
									...activationState,
									cooldownUntil: undefined,
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
					depletion,
				} satisfies ActivationResultSchema.Type;

				return {
					activation: activationResult,
					visualEvents: [
						...visualEvents,
						{
							type: "activation.depleted",
							animation: ActionVisualAnimation.state({
								cause: "stash",
								groupId: `activation:${row.id}:${input.activation}`,
							}),
							itemInstanceId: row.id,
							depletion,
						},
					],
				} satisfies ActionResultSchema.Type & {
					activation: ActivationResultSchema.Type;
				};
			}

			yield* dbFx((db) =>
				db
					.updateTable("itemInstance")
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
			} satisfies ActionResultSchema.Type & {
				activation: ActivationResultSchema.Type;
			};
		}),
	);
});
