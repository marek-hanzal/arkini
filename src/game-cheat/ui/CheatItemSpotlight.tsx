import { useCheatItemSpotlightController } from "~/game-cheat/ui/useCheatItemSpotlightController";
import { ItemSpotlight } from "~/ui/search/ItemSpotlight";

const statusClassName = {
	error: "text-danger",
	idle: "text-muted",
	pending: "text-accent",
	success: "text-muted",
} satisfies Record<useCheatItemSpotlightController.Output["spawnStatus"], string>;

interface CheatItemSpotlightProps extends useCheatItemSpotlightController.Props {}

export const CheatItemSpotlight = (props: CheatItemSpotlightProps) => {
	const controller = useCheatItemSpotlightController(props);
	if (!controller.open) return null;

	return (
		<ItemSpotlight
			dataUi="CheatItemSpotlight"
			emptyMessage="No spawnable items."
			footer={
				<div
					className="min-h-5 text-center text-sm"
					data-status={controller.spawnStatus}
					data-ui="CheatItemSpotlightStatus"
				>
					<p className={statusClassName[controller.spawnStatus]}>
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
