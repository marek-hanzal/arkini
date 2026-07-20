import { TileGridFrame } from "~/ui/tile/TileGridFrame";
import { useToolbarView } from "~/ui/toolbar/useToolbarView";

/** Renders the optional global one-row toolbar through the shared tile-grid surface. */
export const Toolbar = () => {
	const view = useToolbarView();
	if (!view.enabled) return null;

	return (
		<section
			className="min-h-0 min-w-0 overflow-x-auto overflow-y-hidden scrollbar-hidden"
			data-ui="Toolbar"
		>
			<h2 className="sr-only">Toolbar</h2>
			<div
				className="h-full"
				data-ui="ToolbarTrack"
				style={{
					width: `calc(100% * ${view.size} / var(--game-board-columns))`,
				}}
			>
				<TileGridFrame
					surface={view.surface}
					width={view.size}
					height={1}
					cells={view.cells}
					frameUi="ToolbarFrame"
					gridUi="ToolbarGrid"
					cellUi="ToolbarCell"
				/>
			</div>
		</section>
	);
};
