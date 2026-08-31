import { useAtomSet } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { openEditorArkpackAtom } from "~/project-authoring/atom/openEditorArkpackAtom";
import { importArkpackFileAtom } from "~/arkpack-selector/atom/importArkpackFileAtom";
import { openUserArkpackDirectoryAtom } from "~/arkpack-selector/atom/openUserArkpackDirectoryAtom";
import { refreshArkpackCatalogAtom } from "~/arkpack-selector/atom/refreshArkpackCatalogAtom";
import { removeArkpackAtom } from "~/arkpack-selector/atom/removeArkpackAtom";
import { useArkpacks } from "~/arkpack-selector/ui/useArkpacks";
import { useExclusiveAction } from "~/ui/ui/useExclusiveAction";

type BusyAction = "editor" | "import" | "open-directory" | "refresh" | "remove";
type ActiveAction = BusyAction | "exit";

/** Owns selector actions, exit navigation, mounted guards, and Escape lifecycle. */
export const useArkpackSelectorActions = () => {
	const { state } = useArkpacks();
	// TODO(#397): Revalidate stable promise-mode ownership, rejection, and interruption
	// semantics; keep it only while this mounted selector owns the complete async action.
	// Promise-mode command results are atom-wide, so the selector claims one exclusive action
	// before invoking a setter and never overlaps awaited catalog or storage calls.
	const importFileFn = useAtomSet(importArkpackFileAtom, {
		mode: "promise",
	});
	const openEditorFn = useAtomSet(openEditorArkpackAtom, {
		mode: "promise",
	});
	const removeFn = useAtomSet(removeArkpackAtom, {
		mode: "promise",
	});
	const refreshFn = useAtomSet(refreshArkpackCatalogAtom, {
		mode: "promise",
	});
	const openUserDirectoryFn = useAtomSet(openUserArkpackDirectoryAtom, {
		mode: "promise",
	});
	const navigateFn = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
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

	const uploadFn = useCallback(
		async (file: File | undefined) => {
			if (file === undefined || state.type === "loading" || !claimFn("import")) {
				return;
			}
			setActionErrorFn(undefined);
			try {
				const arkpack = await importFileFn(file);
				await navigateFn({
					to: "/action/load-game/$packageId",
					params: {
						packageId: arkpack.packageId,
					},
				});
			} catch (error) {
				if (mountedRef.current) setActionErrorFn(error);
			} finally {
				releaseFn("import");
				if (mountedRef.current) {
					if (inputRef.current !== null) inputRef.current.value = "";
				}
			}
		},
		[
			claimFn,
			importFileFn,
			navigateFn,
			releaseFn,
			state.type,
		],
	);

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

	const removeArkpackFn = useCallback(
		(packageId: string) => runBusyActionFn("remove", () => removeFn(packageId)),
		[
			removeFn,
			runBusyActionFn,
		],
	);

	const refreshArkpacksFn = useCallback(
		() => runBusyActionFn("refresh", () => refreshFn()),
		[
			refreshFn,
			runBusyActionFn,
		],
	);

	const openArkpackDirectoryFn = useCallback(
		() => runBusyActionFn("open-directory", () => openUserDirectoryFn()),
		[
			openUserDirectoryFn,
			runBusyActionFn,
		],
	);

	const openArkpackInEditorFn = useCallback(
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
		inputRef,
		blocked: active !== null || state.type === "loading",
		actionError,
		uploadFn,
		removeArkpackFn,
		openArkpackInEditorFn,
		refreshArkpacksFn,
		openArkpackDirectoryFn,
		requestMainMenuFn,
	};
};
