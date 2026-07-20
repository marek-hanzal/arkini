import type { CSSProperties, PointerEventHandler } from "react";

export namespace TileHoverActionBar {
	export interface Action {
		readonly capability: "info" | "status" | "lines" | "effects";
		readonly icon: string;
		readonly label: string;
	}

	export interface Props {
		readonly actions: ReadonlyArray<Action>;
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
		{...getFloatingProps()}
	>
		{actions.map((action) => (
			<button
				type="button"
				key={action.capability}
				className="grid size-8 place-items-center rounded-lg border-0 bg-transparent text-base leading-none outline-none transition-colors hover:bg-accent/15 focus-visible:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent"
				aria-label={action.label}
				title={action.label}
				data-ui="TileHoverAction"
				data-capability={action.capability}
				onPointerDown={stopPointerDown}
				onClick={(event) => event.preventDefault()}
			>
				<span aria-hidden="true">{action.icon}</span>
			</button>
		))}
	</div>
);
