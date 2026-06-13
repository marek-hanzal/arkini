import { Effect } from "effect";
import { match } from "ts-pattern";
import { createInitialBoardState, readBoardState } from "~/board/logic/boardState";
import { db } from "~/database/local/db";
import { table } from "~/database/local/tables";
import { planPlacements } from "~/inventory/logic/planning";
import type { ItemId } from "~/manifest/data/manifestId";
import type { ProducerMode } from "~/manifest/data/producer";
import { applyPlacementPlanFx } from "~/play/logic/fx/applyPlacementPlanFx";
import { readMutableSaveFx } from "~/play/logic/fx/readMutableSaveFx";
import { toGameActionError } from "~/play/logic/fx/toGameActionError";
import { tryGameActionFx } from "~/play/logic/fx/tryGameActionFx";
import { getProducer } from "~/play/logic/gameDefinitionLookup";
import { ProduceBoardItemInputSchema } from "~/play/logic/gameActionSchemas";
import { localTimestamp } from "~/play/logic/localTimestamp";
import type { BoardItemState, ProducerDropResult } from "~/play/logic/playTypes";
import { GameActionError } from "~/play/logic/playTypes";
import { json } from "~/shared/json";
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

	return yield* tryGameActionFx(() =>
		db.transaction().execute((tx) =>
			Effect.runPromise(
				Effect.gen(function* () {
					const mutable = yield* readMutableSaveFx({
						tx,
					});
					const producerRow = mutable.boardRows.find(
						(row) => row.id === input.boardItemId,
					);
					if (!producerRow)
						return yield* Effect.fail(new GameActionError("Producer does not exist."));

					const producer = getProducer(producerRow.itemDefinitionId);
					if (producer.trigger !== "click") {
						return yield* Effect.fail(
							new GameActionError("This producer runs by itself."),
						);
					}

					const timestamp = Date.now();
					const state = readBoardState(producerRow);
					const producerState = {
						...(createInitialBoardState(producerRow.itemDefinitionId).producer ?? {}),
						...(state.producer ?? {}),
					};

					const mode = producer.mode ?? {
						type: "infinite" as const,
					};
					const isFiniteExhaust =
						input.activation === "exhaust" && mode.type === "finite";

					if (
						!isFiniteExhaust &&
						producerState.cooldownUntil &&
						Date.parse(producerState.cooldownUntil) > timestamp
					) {
						return yield* Effect.fail(
							new GameActionError("Producer is still cooling down."),
						);
					}

					if (
						producerState.remainingCharges !== undefined &&
						producerState.remainingCharges <= 0
					) {
						return yield* Effect.fail(new GameActionError("Producer is empty."));
					}

					const steps = isFiniteExhaust
						? Math.max(1, producerState.remainingCharges ?? mode.charges)
						: 1;

					const allDrops: ItemId[] = [];
					for (let step = 0; step < steps; step++) {
						allDrops.push(
							...(yield* rollOutputFx({
								outputs: producer.output,
							})),
						);
					}

					const plan = planPlacements(
						mutable.save,
						mutable.boardRows,
						mutable.inventoryRows,
						allDrops,
						producerRow,
					);
					if (!plan)
						return yield* Effect.fail(
							new GameActionError("Board and inventory are full."),
						);

					const placements = yield* applyPlacementPlanFx({
						tx,
						plan,
					});
					const nextRemainingCharges = match(mode as ProducerMode)
						.with(
							{
								type: "infinite",
							},
							() => undefined,
						)
						.with(
							{
								type: "finite",
							},
							(finiteMode) =>
								Math.max(
									0,
									(producerState.remainingCharges ?? finiteMode.charges) - steps,
								),
						)
						.exhaustive();

					const shouldDeplete =
						nextRemainingCharges !== undefined && nextRemainingCharges <= 0;
					if (shouldDeplete) {
						const depletion = yield* depleteFx({
							tx,
							row: producerRow,
							mode,
						});
						return {
							producerBoardItemId: producerRow.id,
							placements,
							depletion,
						} satisfies ProducerDropResult;
					}

					yield* tryGameActionFx(() =>
						tx
							.updateTable(table.boardItem)
							.set({
								stateJson: json({
									...state,
									producer: {
										...producerState,
										cooldownUntil: new Date(
											timestamp + (producer.cooldownMs ?? 0),
										).toISOString(),
										remainingCharges: nextRemainingCharges,
									},
								} satisfies BoardItemState),
								updatedAt: localTimestamp(),
							})
							.where("id", "=", producerRow.id)
							.execute(),
					);

					return {
						producerBoardItemId: producerRow.id,
						placements,
					} satisfies ProducerDropResult;
				}),
			),
		),
	);
});
