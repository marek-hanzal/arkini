import { createFileRoute, useNavigate } from "@tanstack/react-router";

import type { ItemEstimateSortSchema } from "~/estimate/schema/ItemEstimateSortSchema";
import { ItemEstimateList } from "~/estimate/ui/ItemEstimateList";

interface EditorEstimateRouteSearch {
	readonly incomplete?: boolean;
	readonly query?: string;
	readonly sort?: ItemEstimateSortSchema.Type;
}

export const Route = createFileRoute("/editor/$projectId/estimate")({
	validateSearch: (search): EditorEstimateRouteSearch => ({
		incomplete: search.incomplete === true ? true : undefined,
		query:
			typeof search.query === "string" && search.query.length > 0 ? search.query : undefined,
		sort: search.sort === "demand" || search.sort === "slowest" ? search.sort : undefined,
	}),
	component: () => {
		const search = Route.useSearch();
		const navigateFn = useNavigate({
			from: Route.fullPath,
		});
		return (
			<ItemEstimateList
				incomplete={search.incomplete ?? false}
				onIncompleteChangeFn={(incomplete) =>
					void navigateFn({
						replace: true,
						search: (current) => ({
							...current,
							incomplete: incomplete || undefined,
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
				onSortChangeFn={(sort) =>
					void navigateFn({
						replace: true,
						search: (current) => ({
							...current,
							sort,
						}),
					})
				}
				query={search.query ?? ""}
				sort={search.sort ?? "fastest"}
			/>
		);
	},
});
