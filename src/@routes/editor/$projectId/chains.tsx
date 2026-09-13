import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { EditorChains } from "~/item-chain/ui/EditorChains";

export const Route = createFileRoute("/editor/$projectId/chains")({
	validateSearch: (
		search,
	): {
		readonly itemId?: string;
	} => ({
		itemId: typeof search.itemId === "string" ? search.itemId : undefined,
	}),
	component: () => {
		const { itemId } = Route.useSearch();
		const navigateFn = useNavigate({
			from: Route.fullPath,
		});
		return (
			<EditorChains
				itemId={itemId ?? ""}
				onItemChangeFn={(nextItemId) =>
					void navigateFn({
						search: {
							itemId: nextItemId || undefined,
						},
					})
				}
			/>
		);
	},
});
