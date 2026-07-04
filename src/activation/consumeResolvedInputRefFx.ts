import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { createBoardItemConsumedEventFx } from "~/board/createBoardItemConsumedEventFx";
import { removeBoardItemFromSaveFx } from "~/board/removeBoardItemFromSaveFx";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";
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

class ConsumeResolvedInputRefScopeFx extends Context.Tag("ConsumeResolvedInputRefScopeFx")<
	ConsumeResolvedInputRefScopeFx,
	Pick<consumeResolvedInputRefFx.Props, "events" | "nextSave" | "reason">
>() {
	//
}

const pushConsumedEvent = ({
	event,
}: {
	event: Extract<
		GameEvent,
		{
			type: "item.consumed";
		}
	>;
}) =>
	Effect.gen(function* () {
		const { events } = yield* ConsumeResolvedInputRefScopeFx;
		events.push(event);
	});

const consumeBoardInputRefFx = Effect.fn("consumeResolvedInputRefFx.consumeBoardInputRefFx")(
	function* (
		boardRef: Extract<
			GameActionResolvedInputRef,
			{
				kind: "board";
			}
		>,
	) {
		const { nextSave, reason } = yield* ConsumeResolvedInputRefScopeFx;
		yield* removeBoardItemFromSaveFx({
			itemInstanceId: boardRef.itemInstanceId,
			runtimeState: "remove",
			save: nextSave,
		});
		yield* pushConsumedEvent({
			event: yield* createBoardItemConsumedEventFx({
				itemId: boardRef.itemId,
				itemInstanceId: boardRef.itemInstanceId,
				reason,
			}),
		});
	},
);

const consumeInventoryInputRefFx = Effect.fn(
	"consumeResolvedInputRefFx.consumeInventoryInputRefFx",
)(function* (
	inventoryRef: Extract<
		GameActionResolvedInputRef,
		{
			kind: "inventory";
		}
	>,
) {
	const { nextSave, reason } = yield* ConsumeResolvedInputRefScopeFx;
	const consumed = yield* consumeInventorySlotQuantityFx({
		nextSave,
		quantity: inventoryRef.quantity,
		reason,
		runtimeState: "remove-instance",
		slotIndex: inventoryRef.slotIndex,
	});

	yield* pushConsumedEvent({
		event: consumed.consumedEvent,
	});
});

const consumeResolvedInputRefProgramFx = Effect.fn(
	"consumeResolvedInputRefFx.consumeResolvedInputRefProgramFx",
)(function* ({ ref }: { ref: GameActionResolvedInputRef }) {
	return yield* match(ref)
		.with(
			{
				kind: "board",
			},
			consumeBoardInputRefFx,
		)
		.with(
			{
				kind: "inventory",
			},
			consumeInventoryInputRefFx,
		)
		.exhaustive();
});

export const consumeResolvedInputRefFx = Effect.fn("consumeResolvedInputRefFx")(function* ({
	events,
	nextSave,
	reason,
	ref,
}: consumeResolvedInputRefFx.Props) {
	return yield* consumeResolvedInputRefProgramFx({
		ref,
	}).pipe(
		Effect.provideService(ConsumeResolvedInputRefScopeFx, {
			events,
			nextSave,
			reason,
		}),
	);
});
