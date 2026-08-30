import { useCheatItemSpotlightController } from "~/game-cheat/ui/useCheatItemSpotlightController";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { ItemSpotlight } from "~/ui/search/ItemSpotlight";

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
			onClose={controller.close}
			onQueryChange={controller.resetSpawnStatus}
			onSelectItem={controller.selectItem}
			options={controller.items.map((item) => ({
				artwork: (
					<img
						className="size-11 object-contain"
						src={item.sourceUrl}
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
