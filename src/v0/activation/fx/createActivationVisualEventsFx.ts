import { Effect } from "effect";
import type { ActivateItemInputSchema } from "~/v0/activation/type/ActivateItemInputSchema";
import type { ActivationPlacementSchema } from "~/v0/activation/type/ActivationPlacementSchema";
import type { BoardItemRowSchema } from "~/v0/board/schema/BoardItemRowSchema";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";

export namespace createActivationVisualEventsFx {
	export interface Props {
		mode: ActivateItemInputSchema.Type["activation"];
		placements: readonly ActivationPlacementSchema.Type[];
		row: BoardItemRowSchema.Type;
	}
}

export const createActivationVisualEventsFx = Effect.fn("createActivationVisualEventsFx")(
	function* ({ mode, placements, row }: createActivationVisualEventsFx.Props) {
		return [
			{
				type: "activation.activated",
				itemInstanceId: row.id,
				mode,
			},
			...placements.flatMap((placement): ActionVisualEventSchema.Type[] => {
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
						itemInstanceId: placement.itemInstanceId,
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
		] satisfies ActionVisualEventSchema.Type[];
	},
);
