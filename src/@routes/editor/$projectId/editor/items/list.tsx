import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { List } from "~/item-authoring/ui/List";

interface EditorItemsRouteSearch {
	readonly itemType?: TypeSchema.Type;
	readonly query?: string;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/list")({
	validateSearch: (search): EditorItemsRouteSearch => ({
		itemType:
			TypeSchema.options.find((type) => type === search.itemType) === undefined
				? undefined
				: (search.itemType as TypeSchema.Type),
		query:
			typeof search.query === "string" && search.query.length > 0 ? search.query : undefined,
	}),
	component: () => {
		const search = Route.useSearch();
		const navigate = useNavigate({
			from: Route.fullPath,
		});
		return (
			<List
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
