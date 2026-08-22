import { PixiBoardToolbarSurface } from "~/ui/pixi/PixiBoardToolbarSurface";

/** Leaves Board + Toolbar rendering and interaction to one native Pixi scene. */
export const GameBoardLayout = ({
	onOpenInventory,
}: {
	readonly onOpenInventory: () => void | PromiseLike<void>;
}) => {
	return (
		<div
			className="size-full min-h-0 min-w-0"
			data-ui="GameBoardLayout"
		>
			<PixiBoardToolbarSurface onOpenInventory={onOpenInventory} />
		</div>
	);
};
