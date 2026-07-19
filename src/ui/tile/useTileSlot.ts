import { useCallback, useContext } from "react";

import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { TileSystemContext } from "~/ui/tile/TileSystemContext";

export namespace useTileSlot {
	export interface Props {
		readonly surface: TileSurface;
		readonly slot: TileSlot;
		readonly occupant: TileIdentity | null;
	}
}

/** Registers one concrete surface slot and exposes coarse hover feedback. */
export const useTileSlot = ({ surface, slot, occupant }: useTileSlot.Props) => {
	const system = useContext(TileSystemContext);
	if (system === null) throw new Error("TileSystemProvider is missing.");
	const { active, registerSlot } = system;

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
	const over =
		active?.phase === "dragging" &&
		active.target?.kind === "slot" &&
		active.target.surface.id === surface.id &&
		active.target.slot.id === slot.id;

	return {
		ref,
		over,
	} as const;
};
