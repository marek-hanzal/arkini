import { useCallback } from "react";
import { match } from "ts-pattern";

import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { useTileSlotSystem } from "~/ui/tile/useTileSlotSystem";

export namespace useTileSlot {
	export interface Props {
		readonly surface: TileSurface;
		readonly slot: TileSlot;
		readonly occupant: TileIdentity | null;
	}
}

/** Registers one concrete surface slot and exposes coarse hover feedback. */
export const useTileSlot = ({ surface, slot, occupant }: useTileSlot.Props) => {
	const { active, registerSlot } = useTileSlotSystem();

	const ref = useCallback(
		(node: HTMLElement | null) =>
			registerSlot(
				{
					surface,
					slot,
					occupant,
				},
				node,
			),
		[
			occupant,
			registerSlot,
			slot,
			surface,
		],
	);
	const over = match(active)
		.with(
			{
				phase: "dragging",
				target: {
					kind: "slot",
				},
			},
			({ target }) => target.surface.id === surface.id && target.slot.id === slot.id,
		)
		.otherwise(() => false);

	return {
		ref,
		over,
	} as const;
};
