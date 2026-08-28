import { useMemo } from "react";

import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
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
