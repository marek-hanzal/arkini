import { useCheatItemSpotlightController } from "~/ui/cheat-spotlight/useCheatItemSpotlightController";
import { SpotlightSearchInput } from "~/ui/search/SpotlightSearchInput";

const statusClassName = {
	error: "text-danger",
	idle: "text-muted",
	pending: "text-accent",
	success: "text-muted",
} satisfies Record<useCheatItemSpotlightController.Output["spawnStatus"], string>;

export namespace CheatItemSpotlight {
	export interface Props extends useCheatItemSpotlightController.Props {}
}

export const CheatItemSpotlight = (props: CheatItemSpotlight.Props) => {
	const controller = useCheatItemSpotlightController(props);
	if (!controller.open) return null;

	return (
		<div
			className="absolute inset-0 z-[75] grid cursor-default place-items-start overflow-hidden bg-overlay/75 p-[var(--ak-viewport-padding)] pt-[12vh] text-overlay-foreground"
			data-ui="CheatItemSpotlightBackdrop"
			onPointerDown={controller.onBackdropPointerDown}
		>
			<section
				className="mx-auto grid w-[38rem] max-w-full gap-3 rounded-2xl border border-line-strong bg-surface-raised p-4 text-foreground shadow-2xl"
				data-ui="CheatItemSpotlight"
				onKeyDown={controller.onKeyDown}
			>
				<SpotlightSearchInput
					inputRef={controller.inputRef}
					onEnter={controller.requestSelected}
					onQueryChange={controller.onQueryChange}
					onSelectedIndexChange={controller.setSelectedIndex}
					query={controller.query}
					resultCount={controller.results.length}
					selectedIndex={controller.selectedIndex}
				/>

				<div
					className="grid max-h-[26rem] gap-1 overflow-y-auto"
					data-ui="CheatItemSpotlightResults"
				>
					{controller.results.length === 0 ? (
						<p className="px-3 py-6 text-center text-sm text-muted">
							No spawnable items.
						</p>
					) : (
						controller.results.map((item, index) => (
							<button
								type="button"
								key={item.itemId}
								className="ak-spotlight-option grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-lg border px-3 py-2 text-left"
								data-item-id={item.itemId}
								data-selected={
									index === controller.selectedIndex ? "true" : undefined
								}
								onMouseEnter={() => controller.setSelectedIndex(index)}
								onClick={() =>
									controller.selectItem({
										index,
										itemId: item.itemId,
									})
								}
							>
								<img
									src={item.sourceUrl}
									alt=""
									className="size-11 object-contain"
								/>
								<span className="min-w-0">
									<span className="block truncate text-sm font-semibold">
										{item.title}
									</span>
									<span className="ak-spotlight-option-secondary block truncate text-xs">
										{item.itemId}
									</span>
								</span>
							</button>
						))
					)}
				</div>

				<div
					className="min-h-5 text-center text-sm"
					data-status={controller.spawnStatus}
					data-ui="CheatItemSpotlightStatus"
				>
					<p className={statusClassName[controller.spawnStatus]}>
						{controller.spawnStatusMessage}
					</p>
				</div>
			</section>
		</div>
	);
};
