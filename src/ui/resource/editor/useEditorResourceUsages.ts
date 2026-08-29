import { useMemo } from "react";

import { useEditorProject } from "~/ui/editor/useEditorProject";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { readGameResourceUsagesFx } from "~/engine/resource/readGameResourceUsagesFx";

/** Projects the current canonical project resource references for editor presentation. */
export const useEditorResourceUsages = () => {
	const { config } = useEditorProject();
	return useMemo(
		() => RendererRuntime.runSync(readGameResourceUsagesFx(config)),
		[
			config,
		],
	);
};
