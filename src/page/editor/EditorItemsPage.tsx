import { getRouteApi, useNavigate } from "@tanstack/react-router";

import { EditorItemList } from "~/ui/item/editor/EditorItemList";

const itemsRoute = getRouteApi("/editor/$projectId/editor/items/list");

export const EditorItemsPage = () => {
	const search = itemsRoute.useSearch();
	const navigate = useNavigate({
		from: "/editor/$projectId/editor/items/list",
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
};
