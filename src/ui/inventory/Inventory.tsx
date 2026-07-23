import { useEffect, useRef } from "react";

import { TileGridFrame } from "~/ui/tile/TileGridFrame";
import { useInventoryControl } from "~/ui/inventory/useInventoryControl";
import { useInventoryView } from "~/ui/inventory/useInventoryView";

/** Renders the active Inventory through the shared tile-grid surface. */
export const Inventory = () => {
	const control = useInventoryControl();
	const view = useInventoryView();
	const closeButtonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		closeButtonRef.current?.focus();
	}, []);

	return (
		<section
			className="pointer-events-auto flex max-h-full w-[min(42rem,70%)] min-w-0 flex-col gap-3 rounded-2xl border border-line-strong bg-surface-raised/95 p-[var(--ak-panel-padding)] text-foreground shadow-2xl"
			aria-labelledby="inventory-title"
			data-ui="Inventory"
		>
			<header className="flex min-w-0 items-center justify-between gap-4">
				<h2
					id="inventory-title"
					className="truncate text-lg font-semibold"
				>
					Inventory
				</h2>
				<button
					ref={closeButtonRef}
					type="button"
					className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-line bg-surface text-lg leading-none text-muted transition-colors hover:bg-accent/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					aria-label="Close inventory"
					onClick={() => control.close()}
				>
					×
				</button>
			</header>
			<div
				className="min-h-0 min-w-0 overflow-auto"
				data-ui="InventoryViewport"
			>
				<div
					className="mx-auto w-full"
					data-ui="InventoryGridAspect"
					style={{
						aspectRatio: `${view.width} / ${view.height}`,
					}}
				>
					<TileGridFrame
						surface={view.surface}
						width={view.width}
						height={view.height}
						cells={view.cells}
						frameUi="InventoryFrame"
						gridUi="InventoryGrid"
						cellUi="InventoryCell"
					/>
				</div>
			</div>
		</section>
	);
};
