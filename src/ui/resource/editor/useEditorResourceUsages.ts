import { useMemo } from "react";

import { useEditorProject } from "~/ui/editor/useEditorProject";
import { readGameResourceUsagesFn } from "~/engine/resource/fn/readGameResourceUsagesFn";

/** Projects the current canonical project resource references for editor presentation. */
export const useEditorResourceUsages = () => {
	const { config } = useEditorProject();
	return useMemo(
		() => readGameResourceUsagesFn(config),
		[
			config,
		],
	);
};
