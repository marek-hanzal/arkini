import { useMemo } from "react";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";

/** Resolves one canonical project item by its immutable UID. */
export const useItemByUid = (uid: string) => {
	const project = useEditorProject();
	return useMemo(
		() => project.config.items[uid],
		[
			project.config.items,
			uid,
		],
	);
};
