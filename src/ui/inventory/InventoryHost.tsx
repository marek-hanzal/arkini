import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { Inventory } from "~/ui/inventory/Inventory";
import { useInventoryControl } from "~/ui/inventory/useInventoryControl";

const inventoryOverlayZIndex = 50;

/** Mounts the independent Inventory canvas only while its React modal is open. */
export const InventoryHost = () => {
	const control = useInventoryControl();
	if (!control.isOpen) return null;

	return (
		<div
			className="absolute inset-0 grid cursor-default place-items-center overflow-hidden bg-overlay/70 p-[var(--ak-viewport-padding)] text-overlay-foreground"
			data-ui="InventoryHost"
			style={{
				zIndex: inventoryOverlayZIndex,
			}}
			onPointerDown={(event) => {
				if (event.target !== event.currentTarget) return;
				RendererRuntime.runSync(control.closeFx());
			}}
		>
			<Inventory />
		</div>
	);
};
