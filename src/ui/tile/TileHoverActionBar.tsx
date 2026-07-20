import type { useTileCapabilities } from "~/bridge/tile/useTileCapabilities";
import type { CSSProperties, PointerEventHandler } from "react";

export namespace TileHoverActionBar {
	export interface Action {
		readonly capability: useTileCapabilities.Capability;
		readonly iconUrl: string;
		readonly label: string;
		readonly onSelect: () => void;
	}

	export interface Props {
		readonly actions: ReadonlyArray<Action>;
		readonly openDelayMs: number;
		readonly mainAxisOffset: number;
		readonly placement: string;
		readonly referenceId: string;
		readonly style: CSSProperties;
		readonly setFloating: (node: HTMLElement | null) => void;
		readonly getFloatingProps: (userProps?: Record<string, unknown>) => Record<string, unknown>;
	}
}

const stopPointerDown: PointerEventHandler<HTMLButtonElement> = (event) => {
	event.stopPropagation();
};

const ActionTooltipOpenDelayMs = 250;

/** Renders the temporary capability affordances without owning their future workspace actions. */
export const TileHoverActionBar = ({
	actions,
	openDelayMs,
	mainAxisOffset,
	placement,
	referenceId,
	style,
	setFloating,
	getFloatingProps,
}: TileHoverActionBar.Props) => (
	<div
		ref={setFloating}
		style={style}
		className="z-50 flex items-center gap-1 overflow-visible rounded-xl border border-line-strong bg-surface-raised/95 p-1 backdrop-blur-sm"
		role="toolbar"
		aria-label="Tile actions"
		data-ui="TileHoverActionBar"
		data-reference-id={referenceId}
		data-placement={placement}
		data-main-axis-offset={mainAxisOffset}
		data-open-delay-ms={openDelayMs}
		{...getFloatingProps()}
	>
		{actions.map((action) => (
			<button
				type="button"
				key={action.capability}
				className="group relative grid size-8 place-items-center overflow-visible rounded-lg border-0 bg-transparent leading-none outline-none transition-colors hover:bg-accent/15 focus-visible:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent"
				aria-label={action.label}
				data-ui="TileHoverAction"
				data-capability={action.capability}
				onPointerDown={stopPointerDown}
				onClick={(event) => {
					event.preventDefault();
					action.onSelect();
				}}
			>
				<img
					src={action.iconUrl}
					width={24}
					height={24}
					className="size-6 object-contain transition-transform duration-150 ease-out will-change-transform group-hover:scale-150 group-focus-visible:scale-150"
					alt=""
					aria-hidden="true"
					draggable={false}
				/>
				<span
					role="tooltip"
					className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md border border-line bg-surface-raised px-2 py-1 text-xs font-medium leading-none text-foreground opacity-0 shadow-lg transition-[opacity,transform] duration-100 [transition-delay:0ms] group-hover:translate-y-0 group-hover:opacity-100 group-hover:[transition-delay:250ms] group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
					data-ui="TileHoverActionTooltip"
					data-capability={action.capability}
					data-open-delay-ms={ActionTooltipOpenDelayMs}
				>
					{action.label}
				</span>
			</button>
		))}
	</div>
);
