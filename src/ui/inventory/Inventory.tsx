import { useEffect, useRef } from "react";

import { PixiInventorySurface } from "~/ui/pixi/PixiInventorySurface";

/** Frames the standalone full-screen Inventory scene and its explicit Board return. */
export const Inventory = ({ onClose }: { readonly onClose: () => void }) => {
	const backButtonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		backButtonRef.current?.focus();
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
				ref={backButtonRef}
				type="button"
				className="absolute left-[var(--ak-viewport-padding)] top-[var(--ak-viewport-padding)] z-10 grid size-14 shrink-0 cursor-pointer place-items-center bg-transparent text-foreground transition-[color,transform] hover:-translate-x-0.5 hover:text-accent"
				aria-label="Back to board"
				data-ui="InventoryBackButton"
				onClick={onClose}
			>
				<span
					className="icon-[lucide--arrow-left] size-9"
					aria-hidden="true"
				/>
			</button>
			<div
				className="size-full min-h-0 min-w-0"
				data-ui="InventoryViewport"
			>
				<PixiInventorySurface onSpaceActivated={onClose} />
			</div>
		</section>
	);
};
