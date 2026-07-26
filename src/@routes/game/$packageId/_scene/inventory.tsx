import { createFileRoute } from "@tanstack/react-router";

import { InventoryPage } from "~/page/game/InventoryPage";

export const Route = createFileRoute("/game/$packageId/_scene/inventory")({
	component: InventoryRoute,
});

function InventoryRoute() {
	const { packageId } = Route.useParams();
	return <InventoryPage packageId={packageId} />;
}
