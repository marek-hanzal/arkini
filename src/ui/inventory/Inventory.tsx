import { useEffect, useRef } from "react";

import { PixiInventorySurface } from "~/ui/pixi/PixiInventorySurface";

/** Frames the standalone full-screen Inventory scene and its explicit Board return. */
export const Inventory = ({ onClose }: { readonly onClose: () => void }) => {
	const closeButtonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		closeButtonRef.current?.focus();
	}, []);

	return (
		<section
			className="relative size-full min-h-0 min-w-0 cursor-default overflow-hidden text-foreground"
			aria-labelledby="inventory-title"
			data-ui="Inventory"
		>
			<h1
				id="inventory-title"
				className="sr-only"
			>
				Inventory
			</h1>
			<button
				ref={closeButtonRef}
				type="button"
				className="absolute right-[var(--ak-viewport-padding)] top-[var(--ak-viewport-padding)] z-10 grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-line bg-surface/90 text-xl leading-none text-muted shadow-lg backdrop-blur transition-colors hover:bg-accent/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				aria-label="Close inventory"
				onClick={onClose}
			>
				×
			</button>
			<div
				className="size-full min-h-0 min-w-0"
				data-ui="InventoryViewport"
			>
				<PixiInventorySurface />
			</div>
		</section>
	);
};
