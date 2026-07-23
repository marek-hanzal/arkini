import { Inventory } from "~/ui/inventory/Inventory";
import { useInventoryControl } from "~/ui/inventory/useInventoryControl";
import { tileInventoryOverlayZIndex } from "~/ui/tile/TileActorStacking";

/** Mounts the Inventory surface only while open without blocking the rest of the tile scene. */
export const InventoryHost = () => {
	const control = useInventoryControl();
	if (!control.isOpen) return null;

	return (
		<div
			className="pointer-events-none absolute inset-0 flex items-start justify-end p-[var(--ak-viewport-padding)]"
			data-ui="InventoryHost"
			style={{
				zIndex: tileInventoryOverlayZIndex,
			}}
		>
			<Inventory />
		</div>
	);
};
