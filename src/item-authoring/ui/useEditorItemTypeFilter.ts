import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import type { TypeSchema } from "~/item-definition/schema/TypeSchema";

/** Shares the URL-backed item-type filter between the item and estimate catalogs. */
export const useEditorItemTypeFilter = (
	from: "/editor/$projectId/editor/items/list" | "/editor/$projectId/estimate",
) => {
	const navigateFn = useNavigate({
		from,
	});
	return useCallback(
		(itemType: TypeSchema.Type | undefined) => {
			void navigateFn({
				replace: true,
				search: (current) => ({
					...current,
					itemType,
				}),
			});
		},
		[
			navigateFn,
		],
	);
};
