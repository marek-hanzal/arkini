import { useAtomSet } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { openEditorSerapackAtom } from "~/project-authoring/atom/openEditorSerapackAtom";
import { importSerapackFileAtom } from "~/serapack-selector/atom/importSerapackFileAtom";
import { openUserSerapackDirectoryAtom } from "~/serapack-selector/atom/openUserSerapackDirectoryAtom";
import { refreshSerapackCatalogAtom } from "~/serapack-selector/atom/refreshSerapackCatalogAtom";
import { removeSerapackAtom } from "~/serapack-selector/atom/removeSerapackAtom";
import { useSerapacks } from "~/serapack-selector/ui/useSerapacks";
import { useExclusiveAction } from "~/ui/ui/useExclusiveAction";

type BusyAction = "editor" | "import" | "open-directory" | "refresh" | "remove";
type ActiveAction = BusyAction | "exit";

/** Owns selector actions, exit navigation, mounted guards, and Escape lifecycle. */
export const useSerapackSelectorActions = () => {
	const { state } = useSerapacks();
	// TODO(#397): Revalidate stable promise-mode ownership, rejection, and interruption
	// semantics; keep it only while this mounted selector owns the complete async action.
	// Promise-mode command results are atom-wide, so the selector claims one exclusive action
	// before invoking a setter and never overlaps awaited catalog or storage calls.
	const importFileFn = useAtomSet(importSerapackFileAtom, {
		mode: "promise",
	});
	const openEditorFn = useAtomSet(openEditorSerapackAtom, {
		mode: "promise",
	});
	const removeFn = useAtomSet(removeSerapackAtom, {
		mode: "promise",
	});
	const refreshFn = useAtomSet(refreshSerapackCatalogAtom, {
		mode: "promise",
	});
	const openUserDirectoryFn = useAtomSet(openUserSerapackDirectoryAtom, {
		mode: "promise",
	});
	const navigateFn = useNavigate();
	const mountedRef = useRef(false);
	const [actionError, setActionErrorFn] = useState<unknown>();
	const { active, claimFn, releaseFn } = useExclusiveAction<ActiveAction>();

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const requestMainMenuFn = useCallback(() => {
		if (state.type === "loading" || !claimFn("exit")) return;
		setActionErrorFn(undefined);
		void (async () => {
			try {
				await navigateFn({
					to: "/main-menu",
				});
			} catch (error) {
				if (mountedRef.current) setActionErrorFn(error);
			} finally {
				releaseFn("exit");
			}
		})();
	}, [
		claimFn,
		navigateFn,
		releaseFn,
		state.type,
	]);

	useEffect(() => {
		const onKeyDownFn = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			requestMainMenuFn();
		};
		window.addEventListener("keydown", onKeyDownFn);
		return () => window.removeEventListener("keydown", onKeyDownFn);
	}, [
		requestMainMenuFn,
	]);

	const uploadFn = useCallback(async () => {
		if (state.type === "loading" || !claimFn("import")) {
			return;
		}
		setActionErrorFn(undefined);
		try {
			const serapack = await importFileFn(undefined);
			if (serapack === null) return;
			await navigateFn({
				to: "/action/load-game/$packageId",
				params: {
					packageId: serapack.packageId,
				},
			});
		} catch (error) {
			if (mountedRef.current) setActionErrorFn(error);
		} finally {
			releaseFn("import");
		}
	}, [
		claimFn,
		importFileFn,
		navigateFn,
		releaseFn,
		state.type,
	]);

	const runBusyActionFn = useCallback(
		(action: Exclude<BusyAction, "import">, operationFn: () => Promise<unknown>) => {
			if (state.type === "loading" || !claimFn(action)) return;
			setActionErrorFn(undefined);
			void operationFn()
				.catch((error: unknown) => {
					if (mountedRef.current) setActionErrorFn(error);
				})
				.finally(() => releaseFn(action));
		},
		[
			claimFn,
			releaseFn,
			state.type,
		],
	);

	const removeSerapackFn = useCallback(
		(packageId: string) => runBusyActionFn("remove", () => removeFn(packageId)),
		[
			removeFn,
			runBusyActionFn,
		],
	);

	const refreshSerapacksFn = useCallback(
		() => runBusyActionFn("refresh", () => refreshFn()),
		[
			refreshFn,
			runBusyActionFn,
		],
	);

	const openSerapackDirectoryFn = useCallback(
		() => runBusyActionFn("open-directory", () => openUserDirectoryFn()),
		[
			openUserDirectoryFn,
			runBusyActionFn,
		],
	);

	const openSerapackInEditorFn = useCallback(
		(packageId: string) =>
			runBusyActionFn("editor", async () => {
				const project = await openEditorFn(packageId);
				await navigateFn({
					to: "/editor/$projectId/editor/items/list",
					params: {
						projectId: project.projectId,
					},
				});
			}),
		[
			navigateFn,
			openEditorFn,
			runBusyActionFn,
		],
	);

	return {
		state,
		blocked: active !== null || state.type === "loading",
		actionError,
		uploadFn,
		removeSerapackFn,
		openSerapackInEditorFn,
		refreshSerapacksFn,
		openSerapackDirectoryFn,
		requestMainMenuFn,
	};
};
