import { useMemo } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";

/** Reads one exact asset from the current canonical editor project snapshot. */
export const useEditorAssetById = (resourceId: string) => {
	const { resources } = useEditorProject();
	return useMemo(
		() => resources.find((resource) => resource.id === resourceId),
		[
			resourceId,
			resources,
		],
	);
};
