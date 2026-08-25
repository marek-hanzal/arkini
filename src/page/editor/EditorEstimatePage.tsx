import { getRouteApi, useNavigate } from "@tanstack/react-router";

import { EditorItemEstimateList } from "~/ui/item/editor/EditorItemEstimateList";

const estimateRoute = getRouteApi("/editor/$projectId/estimate");

export const EditorEstimatePage = () => {
	const search = estimateRoute.useSearch();
	const navigate = useNavigate({
		from: "/editor/$projectId/estimate",
	});
	return (
		<EditorItemEstimateList
			onQueryChange={(query) =>
				void navigate({
					replace: true,
					search: (current) => ({
						...current,
						query,
					}),
				})
			}
			onSortChange={(sort) =>
				void navigate({
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
};
