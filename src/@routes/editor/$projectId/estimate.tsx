import { createFileRoute, useNavigate } from "@tanstack/react-router";

import type { ItemEstimateViewSchema } from "~/estimate/schema/ItemEstimateViewSchema";
import { ItemEstimateList } from "~/estimate/ui/ItemEstimateList";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";

interface EditorEstimateRouteSearch {
	readonly itemType?: TypeSchema.Type;
	readonly query?: string;
	readonly view?: ItemEstimateViewSchema.Type;
}

export const Route = createFileRoute("/editor/$projectId/estimate")({
	validateSearch: (search): EditorEstimateRouteSearch => ({
		itemType:
			TypeSchema.options.find((type) => type === search.itemType) === undefined
				? undefined
				: (search.itemType as TypeSchema.Type),
		query:
			typeof search.query === "string" && search.query.length > 0 ? search.query : undefined,
		view:
			search.view === "demand" || search.view === "slowest" || search.view === "incomplete"
				? search.view
				: undefined,
	}),
	component: () => {
		const search = Route.useSearch();
		const navigateFn = useNavigate({
			from: Route.fullPath,
		});
		return (
			<ItemEstimateList
				itemType={search.itemType}
				onItemTypeChangeFn={(itemType) =>
					void navigateFn({
						replace: true,
						search: (current) => ({
							...current,
							itemType,
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
				onViewChangeFn={(view) =>
					void navigateFn({
						replace: true,
						search: (current) => ({
							...current,
							view,
						}),
					})
				}
				query={search.query ?? ""}
				view={search.view ?? "fastest"}
			/>
		);
	},
});
