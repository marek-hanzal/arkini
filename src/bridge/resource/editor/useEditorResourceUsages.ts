import { Effect } from "effect";
import { useMemo } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { readGameResourceUsagesFx } from "~/engine/resource/readGameResourceUsagesFx";

/** Projects the current canonical project resource references for editor presentation. */
export const useEditorResourceUsages = () => {
	const { config } = useEditorProject();
	return useMemo(
		() => Effect.runSync(readGameResourceUsagesFx(config)),
		[
			config,
		],
	);
};
