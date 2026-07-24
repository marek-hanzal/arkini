import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { createExclusiveActionOwnerFx } from "~/ui/action/createExclusiveActionOwnerFx";

/** Owns one synchronous UI action claim and exposes it as one React snapshot. */
export const useExclusiveAction = <Action extends string>() => {
	const [owner] = useState(() => RendererRuntime.runSync(createExclusiveActionOwnerFx<Action>()));
	const active = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
	const claim = useCallback(
		(action: Action) => RendererRuntime.runSync(owner.claimFx(action)),
		[
			owner,
		],
	);
	const release = useCallback(
		(action: Action) => RendererRuntime.runSync(owner.releaseFx(action)),
		[
			owner,
		],
	);

	return useMemo(
		() => ({
			active,
			claim,
			getSnapshot: owner.getSnapshot,
			release,
		}),
		[
			active,
			claim,
			owner,
			release,
		],
	);
};
