import { useCallback, useLayoutEffect, useRef } from "react";

import type { TileIdentity } from "~/ui/tile/TileIdentity";
import type { TileSlot } from "~/ui/tile/TileSlot";
import type { TileSurface } from "~/ui/tile/TileSurface";
import { useTileSlotInteraction } from "~/ui/tile/useTileSlotInteraction";
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
	const { refreshSlotTarget, registerSlot } = useTileSlotSystem();
	const nodeRef = useRef<HTMLElement | null>(null);
	const registeredRef = useRef<useTileSlot.Props | null>(null);
	const registrationRef = useRef({
		surface,
		slot,
		occupant,
	});
	registrationRef.current = {
		surface,
		slot,
		occupant,
	};

	const ref = useCallback(
		(node: HTMLElement | null) => {
			const previous = registeredRef.current;
			if (nodeRef.current === node) return;
			if (nodeRef.current !== null && previous !== null) {
				registerSlot(previous, null);
			}
			nodeRef.current = node;
			if (node === null) {
				registeredRef.current = null;
				return;
			}
			const registration = registrationRef.current;
			registerSlot(registration, node);
			registeredRef.current = registration;
		},
		[
			registerSlot,
		],
	);
	useLayoutEffect(() => {
		const node = nodeRef.current;
		const previous = registeredRef.current;
		if (node === null || previous === null) return;
		const registration = registrationRef.current;
		if (
			previous.surface.id !== registration.surface.id ||
			previous.slot.id !== registration.slot.id
		) {
			registerSlot(previous, null);
		}
		const change = registerSlot(registration, node);
		if (change === "semantic") {
			refreshSlotTarget({
				kind: "slot",
				...registration,
			});
		}
		registeredRef.current = registration;
	}, [
		occupant?.id,
		occupant?.revision,
		refreshSlotTarget,
		registerSlot,
		slot.id,
		slot.x,
		slot.y,
		surface.id,
		surface.kind,
		surface.kind === "board" ? surface.space : null,
	]);
	const over = useTileSlotInteraction(surface.id, slot.id);

	return {
		ref,
		over,
	} as const;
};
