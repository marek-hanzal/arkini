import type { CSSProperties, PointerEventHandler } from "react";

export namespace TileHoverActionBar {
	export interface Action {
		readonly capability: "info" | "status" | "lines" | "effects";
		readonly iconUrl: string;
		readonly label: string;
	}

	export interface Props {
		readonly actions: ReadonlyArray<Action>;
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

/** Renders the temporary capability affordances without owning their future workspace actions. */
export const TileHoverActionBar = ({
	actions,
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
		className="z-50 flex items-center gap-1 rounded-xl border border-line-strong bg-surface-raised/95 p-1 shadow-xl backdrop-blur-sm"
		role="toolbar"
		aria-label="Tile actions"
		data-ui="TileHoverActionBar"
		data-reference-id={referenceId}
		data-placement={placement}
		data-main-axis-offset={mainAxisOffset}
		{...getFloatingProps()}
	>
		{actions.map((action) => (
			<button
				type="button"
				key={action.capability}
				className="grid size-8 place-items-center rounded-lg border-0 bg-transparent leading-none outline-none transition-colors hover:bg-accent/15 focus-visible:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent"
				aria-label={action.label}
				title={action.label}
				data-ui="TileHoverAction"
				data-capability={action.capability}
				onPointerDown={stopPointerDown}
				onClick={(event) => event.preventDefault()}
			>
				<img
					src={action.iconUrl}
					width={24}
					height={24}
					className="size-6 object-contain"
					alt=""
					aria-hidden="true"
					draggable={false}
				/>
			</button>
		))}
	</div>
);
