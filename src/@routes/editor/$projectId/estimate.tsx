import { createFileRoute, useNavigate } from "@tanstack/react-router";

import type { ItemEstimateViewSchema } from "~/estimate/schema/ItemEstimateViewSchema";
import { ItemEstimateList } from "~/estimate/ui/ItemEstimateList";

interface EditorEstimateRouteSearch {
	readonly query?: string;
	readonly view?: ItemEstimateViewSchema.Type;
}

export const Route = createFileRoute("/editor/$projectId/estimate")({
	validateSearch: (search): EditorEstimateRouteSearch => ({
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
