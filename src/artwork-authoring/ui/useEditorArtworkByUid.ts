import { useMemo } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";

/** Reads one exact artwork from the current canonical editor project snapshot. */
export const useEditorArtworkByUid = (resourceUid: string) => {
	const { resources } = useEditorProject();
	return useMemo(
		() =>
			resources.find(
				(resource) => resource.uid === resourceUid && resource.type === "artwork",
			),
		[
			resourceUid,
			resources,
		],
	);
};
