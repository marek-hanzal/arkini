import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { InventoryPage } from "~/page/game/InventoryPage";

export const Route = createFileRoute("/game/$packageId/_scene/inventory")({
	component: InventoryRoute,
});

function InventoryRoute() {
	const { packageId } = Route.useParams();
	const navigate = useNavigate();
	return (
		<InventoryPage
			onClose={() => {
				void navigate({
					to: "/game/$packageId/board",
					params: {
						packageId,
					},
					replace: true,
				}).catch((cause) => {
					console.error("Inventory failed to return to the Board.", cause);
				});
			}}
		/>
	);
}
