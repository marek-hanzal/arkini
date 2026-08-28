import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { EditorItemTypes, type EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { EditorItemList } from "~/ui/item/editor/EditorItemList";

interface EditorItemsRouteSearch {
	readonly itemType?: EditorItemType;
	readonly query?: string;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/list")({
	validateSearch: (search): EditorItemsRouteSearch => ({
		itemType:
			EditorItemTypes.find((type) => type === search.itemType) === undefined
				? undefined
				: (search.itemType as EditorItemType),
		query:
			typeof search.query === "string" && search.query.length > 0 ? search.query : undefined,
	}),
	component: () => {
		const search = Route.useSearch();
		const navigate = useNavigate({
			from: Route.fullPath,
		});
		return (
			<EditorItemList
				itemType={search.itemType}
				query={search.query ?? ""}
				onItemTypeChange={(itemType) =>
					void navigate({
						replace: true,
						search: (current) => ({
							...current,
							itemType,
						}),
					})
				}
				onQueryChange={(query) =>
					void navigate({
						replace: true,
						search: (current) => ({
							...current,
							query,
						}),
					})
				}
			/>
		);
	},
});
