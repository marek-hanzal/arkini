import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { List } from "~/item-authoring/ui/List";

interface EditorItemsRouteSearch {
	readonly draft?: true;
	readonly itemType?: TypeSchema.Type;
	readonly layer?: ItemSchema.Type["layer"];
	readonly query?: string;
}

export const Route = createFileRoute("/editor/$projectId/editor/items/list")({
	validateSearch: (search): EditorItemsRouteSearch => ({
		draft: search.draft === true ? true : undefined,
		itemType:
			TypeSchema.options.find((type) => type === search.itemType) === undefined
				? undefined
				: (search.itemType as TypeSchema.Type),
		layer: search.layer === "content" || search.layer === "ground" ? search.layer : undefined,
		query:
			typeof search.query === "string" && search.query.length > 0 ? search.query : undefined,
	}),
	component: () => {
		const search = Route.useSearch();
		const navigateFn = useNavigate({
			from: Route.fullPath,
		});
		return (
			<List
				draft={search.draft === true}
				itemType={search.itemType}
				layer={search.layer}
				query={search.query ?? ""}
				onItemTypeChangeFn={(itemType) =>
					void navigateFn({
						replace: true,
						search: (current) => ({
							...current,
							itemType,
						}),
					})
				}
				onLayerChangeFn={(layer) =>
					void navigateFn({
						replace: true,
						search: (current) => ({
							...current,
							layer,
						}),
					})
				}
				onDraftChangeFn={(draft) =>
					void navigateFn({
						replace: true,
						search: (current) => ({
							...current,
							draft: draft ? true : undefined,
						}),
					})
				}
				onQueryChangeFn={(query) =>
					void navigateFn({
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
