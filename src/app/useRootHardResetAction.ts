import { useCallback, useRef, useState } from "react";
import { hardResetBrowserStorageFx } from "~/v0/database/fx/hardResetBrowserStorageFx";
import { runGameFx } from "~/v0/fx/runGameFx";

export namespace useRootHardResetAction {
	export type Status = "idle" | "pending" | "failed" | "succeeded";
}

export const useRootHardResetAction = () => {
	const pendingRef = useRef(false);
	const [status, setStatus] = useState<useRootHardResetAction.Status>("idle");

	const run = useCallback(async () => {
		if (pendingRef.current) return;

		pendingRef.current = true;
		setStatus("pending");

		try {
			await runGameFx({
				effect: hardResetBrowserStorageFx,
			});
			setStatus("succeeded");
			window.location.reload();
		} catch (error) {
			pendingRef.current = false;
			setStatus("failed");
			console.error(error);
		}
	}, []);

	return {
		failed: status === "failed",
		pending: status === "pending",
		run,
		status,
	};
};
