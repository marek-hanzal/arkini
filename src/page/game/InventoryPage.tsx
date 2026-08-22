import { PlayableInventory } from "~/ui/game/PlayableInventory";

/**
 * Owns only Inventory-to-Board navigation; the parent scene route keeps the
 * exact Game and shared overlays alive. Escape and the Board's Inventory
 * shortcut return to Board while respecting overlay priority: Item Detail
 * consumes input first, then Game Menu, and only an otherwise unclaimed
 * navigation key replaces this leaf with Board.
 */
export const InventoryPage = ({ onClose }: { readonly onClose: () => void }) => {
	return <PlayableInventory onClose={onClose} />;
};
