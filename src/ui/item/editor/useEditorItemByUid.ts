import { useMemo } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";

/** Resolves one visible canonical or staged item by its immutable UID. */
export const useEditorItemByUid = (uid: string) => {
	const project = useEditorProject();
	return useMemo(
		() => Object.values(project.config?.items ?? {}).find((item) => item.uid === uid),
		[
			project.config?.items,
			uid,
		],
	);
};
