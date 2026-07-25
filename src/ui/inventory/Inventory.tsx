import { useEffect, useRef } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { useInventoryControl } from "~/ui/inventory/useInventoryControl";
import { PixiInventorySurface } from "~/ui/pixi/PixiInventorySurface";

/** Keeps standard React modal ownership around the isolated native Pixi scene. */
export const Inventory = () => {
	const game = useGameEngine();
	const control = useInventoryControl();
	const closeButtonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		closeButtonRef.current?.focus();
	}, []);

	return (
		<section
			role="dialog"
			aria-modal="true"
			className="flex h-[min(46rem,100%)] max-h-full w-full max-w-5xl min-w-0 cursor-default flex-col gap-3 overflow-hidden rounded-2xl border border-line-strong bg-surface-raised p-[var(--ak-panel-padding)] text-foreground shadow-[0_2rem_5rem_color-mix(in_srgb,var(--ak-overlay)_58%,transparent),0_0_0_1px_color-mix(in_srgb,var(--ak-line-strong)_45%,transparent)]"
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
					onClick={() => RendererRuntime.runSync(control.closeFx())}
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
						aspectRatio: `${game.config.meta.inventory.width} / ${game.config.meta.inventory.height}`,
					}}
				>
					<PixiInventorySurface />
				</div>
			</div>
		</section>
	);
};
