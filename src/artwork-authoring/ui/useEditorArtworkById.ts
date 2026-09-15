import { useMemo } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";

/** Reads one exact artwork from the current canonical editor project snapshot. */
export const useEditorArtworkById = (resourceId: string) => {
	const { resources } = useEditorProject();
	return useMemo(
		() =>
			resources.find((resource) => resource.id === resourceId && resource.type === "artwork"),
		[
			resourceId,
			resources,
		],
	);
};
