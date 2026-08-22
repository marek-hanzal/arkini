import { PlayableBoard } from "~/ui/game/PlayableBoard";

export function GamePage({
	onOpenInventory,
}: {
	readonly onOpenInventory: () => void | PromiseLike<void>;
}) {
	return <PlayableBoard onOpenInventory={onOpenInventory} />;
}
