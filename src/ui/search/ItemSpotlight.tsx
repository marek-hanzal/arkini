import type { ReactNode } from "react";

import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { SpotlightSearchInput } from "~/ui/search/SpotlightSearchInput";
import { useItemSpotlightController } from "~/ui/search/useItemSpotlightController";

const backdropPositionClassName = {
	owner: "absolute",
	viewport: "fixed",
} as const;

interface ItemSpotlightProps extends useItemSpotlightController.Props {
	readonly dataUi: string;
	readonly emptyMessage: string;
	readonly footer?: ReactNode;
	readonly placement: keyof typeof backdropPositionClassName;
	readonly placeholder?: string;
}

/** Presents one shared searchable item chooser inside its owning overlay boundary. */
export const ItemSpotlight = (props: ItemSpotlightProps) => {
	const controller = useItemSpotlightController(props);
	return (
		<div
			className={`${backdropPositionClassName[props.placement]} inset-0 z-[80] grid cursor-default place-items-start overflow-hidden bg-overlay/75 p-[var(--ak-viewport-padding)] pt-[12vh] text-overlay-foreground`}
			data-ui={`${props.dataUi}Backdrop`}
			onPointerDown={(event) => {
				if (event.currentTarget === event.target) props.onClose();
			}}
		>
			<div
				className="mx-auto grid w-[38rem] max-w-full gap-3 rounded-2xl border border-line-strong bg-surface-raised p-4 text-foreground shadow-2xl"
				data-ui={props.dataUi}
				onKeyDown={controller.onKeyDown}
			>
				<SpotlightSearchInput
					inputRef={controller.inputRef}
					onEnter={controller.requestSelected}
					onQueryChange={controller.updateQuery}
					onSelectedIndexChange={controller.setSelectedIndex}
					placeholder={props.placeholder}
					query={controller.query}
					resultCount={controller.results.length}
					selectedIndex={controller.selectedIndex}
				/>
				<div
					className="grid max-h-[26rem] gap-1 overflow-y-auto"
					data-ui={`${props.dataUi}Results`}
				>
					{controller.results.length === 0 ? (
						<p className="px-3 py-6 text-center text-sm text-muted">
							{props.emptyMessage}
						</p>
					) : (
						controller.results.map((option, index) => (
							<button
								className="ak-spotlight-option grid grid-cols-[3rem_1fr] items-center gap-3 rounded-lg border px-3 py-2 text-left"
								data-item-id={option.itemId}
								key={option.itemId}
								onClick={() =>
									controller.selectItem({
										index,
										itemId: option.itemId,
									})
								}
								onMouseEnter={() => controller.setSelectedIndex(index)}
								type="button"
								{...readDataUiFn({
									dataUi: "ItemSpotlightOption",
									state: {
										selected: index === controller.selectedIndex,
									},
								})}
							>
								{option.artwork}
								<span className="min-w-0">
									<span className="block truncate text-sm font-semibold">
										{option.label}
									</span>
									<span className="ak-spotlight-option-secondary block truncate text-xs">
										{option.secondary}
									</span>
								</span>
							</button>
						))
					)}
				</div>
				{props.footer}
			</div>
		</div>
	);
};
