import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { removeBoardItemRuntimeStateFx } from "~/board/logic/removeBoardItemRuntimeStateFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEvent } from "~/event/GameEventSchema";
import {
	isGameSaveInventoryInstance,
	readGameSaveInventorySlotQuantity,
} from "~/inventory/model/GameSaveInventorySlot";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { createInventoryItemConsumedEventFx } from "~/inventory/createInventoryItemConsumedEventFx";
import { readInventorySlotAfterQuantityRemovalFx } from "~/inventory/readInventorySlotAfterQuantityRemovalFx";

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
		delete nextSave.board.items[boardRef.itemInstanceId];
		yield* removeBoardItemRuntimeStateFx({
			itemInstanceId: boardRef.itemInstanceId,
			save: nextSave,
		});
		yield* pushConsumedEvent({
			event: {
				from: {
					kind: "board",
					itemInstanceId: boardRef.itemInstanceId,
				},
				itemId: boardRef.itemId,
				reason,
				type: "item.consumed" as const,
			},
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
	const slot = nextSave.inventory.slots[inventoryRef.slotIndex];
	if (!slot) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Missing inventory input at slot ${inventoryRef.slotIndex}.`,
			),
		);
	}

	const previousQuantity = readGameSaveInventorySlotQuantity(slot);
	const nextQuantity = previousQuantity - inventoryRef.quantity;
	if (nextQuantity < 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Inventory input at slot ${inventoryRef.slotIndex} is already spent.`,
			),
		);
	}

	nextSave.inventory.slots[inventoryRef.slotIndex] =
		yield* readInventorySlotAfterQuantityRemovalFx({
			quantity: inventoryRef.quantity,
			slot,
		});
	if (isGameSaveInventoryInstance(slot)) {
		yield* removeBoardItemRuntimeStateFx({
			itemInstanceId: slot.id,
			save: nextSave,
		});
	}

	yield* pushConsumedEvent({
		event: yield* createInventoryItemConsumedEventFx({
			itemId: inventoryRef.itemId,
			nextQuantity,
			previousQuantity,
			quantity: inventoryRef.quantity,
			reason,
			slotIndex: inventoryRef.slotIndex,
		}),
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
