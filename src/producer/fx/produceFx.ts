import { Effect } from "effect";
import { match } from "ts-pattern";
import { createInitialBoardState, readBoardState } from "~/board/logic/boardState";
import { dbFx } from "~/database/fx/dbFx";
import { withTransactionFx } from "~/database/fx/withTransactionFx";
import { table } from "~/database/local/tables";
import { DateServiceFx } from "~/date/context/DateServiceFx";
import { IdServiceFx } from "~/id/context/IdServiceFx";
import { planPlacements } from "~/inventory/logic/planning";
import { GameConfigServiceFx } from "~/manifest/context/GameConfigServiceFx";
import type { ItemId } from "~/manifest/data/manifestId";
import type { ProducerMode } from "~/manifest/data/producer";
import { applyPlacementPlanFx } from "~/play/fx/applyPlacementPlanFx";
import { readMutableSaveFx } from "~/play/fx/readMutableSaveFx";
import { ProduceBoardItemInputSchema } from "~/play/logic/gameActionSchemas";
import type { BoardItemState, ProducerDropResult } from "~/play/logic/playTypes";
import { GameActionError } from "~/play/logic/playTypes";
import { toGameActionError } from "~/play/logic/toGameActionError";
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

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const date = yield* DateServiceFx;
			const gameConfig = yield* GameConfigServiceFx;
			const id = yield* IdServiceFx;
			const now = date.now();
			const timestamp = now.toMillis();
			const updatedAt = date.toTimestamp(now);

			const mutable = yield* readMutableSaveFx();
			const producerRow = mutable.boardRows.find((row) => row.id === input.boardItemId);
			if (!producerRow) {
				return yield* Effect.fail(new GameActionError("Producer does not exist."));
			}

			const producer = gameConfig.getProducer(producerRow.itemDefinitionId);
			if (!producer) {
				return yield* Effect.fail(new GameActionError("This item is not a producer."));
			}
			if (producer.trigger !== "click") {
				return yield* Effect.fail(new GameActionError("This producer runs by itself."));
			}

			const state = readBoardState(producerRow);
			const producerState = {
				...(createInitialBoardState(producerRow.itemDefinitionId, gameConfig).producer ??
					{}),
				...(state.producer ?? {}),
			};

			const mode = producer.mode ?? {
				type: "infinite" as const,
			};
			const isFiniteExhaust = input.activation === "exhaust" && mode.type === "finite";

			if (
				!isFiniteExhaust &&
				producerState.cooldownUntil &&
				(date.parseTimestampMs(producerState.cooldownUntil) ?? 0) > timestamp
			) {
				return yield* Effect.fail(new GameActionError("Producer is still cooling down."));
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
				{
					gameConfig,
					id,
					origin: producerRow,
				},
			);
			if (!plan) {
				return yield* Effect.fail(new GameActionError("Board and inventory are full."));
			}

			const placements = yield* applyPlacementPlanFx({
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
						Math.max(0, (producerState.remainingCharges ?? finiteMode.charges) - steps),
				)
				.exhaustive();

			const shouldDeplete = nextRemainingCharges !== undefined && nextRemainingCharges <= 0;
			if (shouldDeplete) {
				const depletion = yield* depleteFx({
					row: producerRow,
					mode,
				});
				return {
					producerBoardItemId: producerRow.id,
					placements,
					depletion,
				} satisfies ProducerDropResult;
			}

			yield* dbFx((db) =>
				db
					.updateTable(table.boardItem)
					.set({
						stateJson: json({
							...state,
							producer: {
								...producerState,
								cooldownUntil: date.toTimestamp(
									now.plus({
										milliseconds: producer.cooldownMs ?? 0,
									}),
								),
								remainingCharges: nextRemainingCharges,
							},
						} satisfies BoardItemState),
						updatedAt,
					})
					.where("id", "=", producerRow.id)
					.execute(),
			);

			return {
				producerBoardItemId: producerRow.id,
				placements,
			} satisfies ProducerDropResult;
		}),
	);
});
