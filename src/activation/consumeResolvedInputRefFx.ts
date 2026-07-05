import { Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { consumeBoardItemQuantityFx } from "~/board/consumeBoardItemQuantityFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { consumeInventorySlotQuantityFx } from "~/inventory/consumeInventorySlotQuantityFx";

export namespace consumeResolvedInputRefFx {
	export interface Props {
		nextSave: GameSave;
		ref: GameActionResolvedInputRef;
		events: GameEvent[];
		reason: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>["reason"];
	}
}

type ResolvedInputConsumptionContext = Pick<
	consumeResolvedInputRefFx.Props,
	"events" | "nextSave" | "reason"
>;

const pushConsumedEventFx = Effect.fn("consumeResolvedInputRefFx.pushConsumedEventFx")(function* ({
	event,
	events,
}: Pick<ResolvedInputConsumptionContext, "events"> & {
	event: Extract<
		GameEvent,
		{
			type: "item.consumed";
		}
	>;
}) {
	events.push(event);
});

const consumeBoardInputRefFx = Effect.fn("consumeResolvedInputRefFx.consumeBoardInputRefFx")(
	function* ({
		events,
		nextSave,
		reason,
		ref,
	}: ResolvedInputConsumptionContext & {
		ref: Extract<
			GameActionResolvedInputRef,
			{
				kind: "board";
			}
		>;
	}) {
		const consumed = yield* consumeBoardItemQuantityFx({
			itemInstanceId: ref.itemInstanceId,
			nextSave,
			quantity: ref.quantity,
			reason,
			runtimeState: "remove",
		});

		yield* pushConsumedEventFx({
			event: consumed.consumedEvent,
			events,
		});
	},
);

const consumeInventoryInputRefFx = Effect.fn(
	"consumeResolvedInputRefFx.consumeInventoryInputRefFx",
)(function* ({
	events,
	nextSave,
	reason,
	ref,
}: ResolvedInputConsumptionContext & {
	ref: Extract<
		GameActionResolvedInputRef,
		{
			kind: "inventory";
		}
	>;
}) {
	const consumed = yield* consumeInventorySlotQuantityFx({
		nextSave,
		quantity: ref.quantity,
		reason,
		runtimeState: "remove-instance",
		slotIndex: ref.slotIndex,
	});

	yield* pushConsumedEventFx({
		event: consumed.consumedEvent,
		events,
	});
});

const consumeResolvedInputRefProgramFx = Effect.fn(
	"consumeResolvedInputRefFx.consumeResolvedInputRefProgramFx",
)(function* ({ ref, ...context }: consumeResolvedInputRefFx.Props) {
	return yield* match(ref)
		.with(
			{
				kind: "board",
			},
			(boardRef) =>
				consumeBoardInputRefFx({
					...context,
					ref: boardRef,
				}),
		)
		.with(
			{
				kind: "inventory",
			},
			(inventoryRef) =>
				consumeInventoryInputRefFx({
					...context,
					ref: inventoryRef,
				}),
		)
		.exhaustive();
});

export const consumeResolvedInputRefFx = Effect.fn("consumeResolvedInputRefFx")(function* (
	props: consumeResolvedInputRefFx.Props,
) {
	return yield* consumeResolvedInputRefProgramFx(props);
});
