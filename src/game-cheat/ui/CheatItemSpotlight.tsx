import { useCheatItemSpotlightController } from "~/game-cheat/ui/useCheatItemSpotlightController";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { ItemArtwork } from "~/ui/ui/ItemArtwork";
import { ItemSpotlight } from "~/ui/ui/ItemSpotlight";

interface CheatItemSpotlightProps extends useCheatItemSpotlightController.Props {}

export const CheatItemSpotlight = (props: CheatItemSpotlightProps) => {
	const controller = useCheatItemSpotlightController(props);
	if (!controller.open) return null;

	return (
		<ItemSpotlight
			dataUi="CheatItemSpotlight"
			emptyMessage="No spawnable items."
			footer={
				<div className="min-h-5 text-center text-sm">
					<p
						className="text-muted data-[ui-status=error]:text-danger data-[ui-status=pending]:text-accent"
						{...readDataUiFn({
							dataUi: "CheatItemSpotlightStatus",
							state: {
								status: controller.spawnStatus,
							},
						})}
					>
						{controller.spawnStatusMessage}
					</p>
				</div>
			}
			onCloseFn={controller.closeFn}
			onQueryChangeFn={controller.resetSpawnStatusFn}
			onSelectItemFn={controller.selectItemFn}
			options={controller.items.map((item) => ({
				artwork: (
					<ItemArtwork
						compositeUrl={item.compositeUrl}
						sourceUrl={item.sourceUrl}
					/>
				),
				itemId: item.itemId,
				label: item.title,
				secondary: item.itemId,
				terms: [
					item.itemId,
					item.title,
				],
			}))}
			placement="owner"
			resultLimit={10}
		/>
	);
};
