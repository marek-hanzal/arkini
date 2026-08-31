import { ArrowLeft } from "lucide-react";

import { PixiInventorySurface } from "~/game-scene/ui/PixiInventorySurface";

/** Frames the standalone full-screen Inventory scene and its explicit Board return. */
export const Inventory = ({ onClose }: { readonly onClose: () => void }) => (
	<section
		className="relative size-full min-h-0 min-w-0 cursor-default overflow-hidden text-foreground"
		data-ui="Inventory"
	>
		<button
			type="button"
			className="absolute left-[var(--ak-viewport-padding)] top-[var(--ak-viewport-padding)] z-10 grid size-14 shrink-0 cursor-pointer place-items-center bg-transparent text-foreground transition-[color,transform] hover:-translate-x-0.5 hover:text-accent"
			data-ui="InventoryBackButton"
			onClick={onClose}
		>
			<ArrowLeft className="size-9" />
		</button>
		<div
			className="size-full min-h-0 min-w-0"
			data-ui="InventoryViewport"
		>
			<PixiInventorySurface onSpaceActivated={onClose} />
		</div>
	</section>
);
