import { createFileRoute } from "@tanstack/react-router";

import { InventoryPage } from "~/page/game/InventoryPage";

export const Route = createFileRoute("/game/$packageId/_scene/inventory")({
	component: InventoryPage,
});
