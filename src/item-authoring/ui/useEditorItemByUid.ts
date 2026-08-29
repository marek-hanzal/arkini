import { useMemo } from "react";

import { useEditorProject } from "~/authoring-session/useEditorProject";

/** Resolves one canonical project item by its immutable UID. */
export const useEditorItemByUid = (uid: string) => {
	const project = useEditorProject();
	return useMemo(
		() => Object.values(project.config.items).find((item) => item.uid === uid),
		[
			project.config.items,
			uid,
		],
	);
};
