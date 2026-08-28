import { useAtomSet } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { openEditorArkpackAtom } from "~/ui/arkpack/editor/openEditorArkpackAtom";
import { importArkpackFileAtom } from "~/ui/arkpack/importArkpackFileAtom";
import { openUserArkpackDirectoryAtom } from "~/ui/arkpack/openUserArkpackDirectoryAtom";
import { refreshArkpackCatalogAtom } from "~/ui/arkpack/refreshArkpackCatalogAtom";
import { removeArkpackAtom } from "~/ui/arkpack/removeArkpackAtom";
import { useArkpacks } from "~/ui/arkpack/useArkpacks";
import { useExclusiveAction } from "~/ui/action/useExclusiveAction";

type BusyAction = "editor" | "import" | "open-directory" | "refresh" | "remove";
type ActiveAction = BusyAction | "exit";

/** Owns selector actions, exit navigation, mounted guards, and Escape lifecycle. */
export const useArkpackSelectorActions = () => {
	const { state } = useArkpacks();
	// TODO(#397): Revalidate stable promise-mode ownership, rejection, and interruption
	// semantics; keep it only while this mounted selector owns the complete async action.
	// Promise-mode command results are atom-wide, so the selector claims one exclusive action
	// before invoking a setter and never overlaps awaited catalog or storage calls.
	const importFile = useAtomSet(importArkpackFileAtom, {
		mode: "promise",
	});
	const openEditor = useAtomSet(openEditorArkpackAtom, {
		mode: "promise",
	});
	const remove = useAtomSet(removeArkpackAtom, {
		mode: "promise",
	});
	const refresh = useAtomSet(refreshArkpackCatalogAtom, {
		mode: "promise",
	});
	const openUserDirectory = useAtomSet(openUserArkpackDirectoryAtom, {
		mode: "promise",
	});
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const mountedRef = useRef(false);
	const [actionError, setActionError] = useState<unknown>();
	const { active, claim, release } = useExclusiveAction<ActiveAction>();

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const requestMainMenu = useCallback(() => {
		if (state.type === "loading" || !claim("exit")) return;
		setActionError(undefined);
		void (async () => {
			try {
				await navigate({
					to: "/main-menu",
				});
			} catch (error) {
				if (mountedRef.current) setActionError(error);
			} finally {
				release("exit");
			}
		})();
	}, [
		claim,
		navigate,
		release,
		state.type,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			requestMainMenu();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		requestMainMenu,
	]);

	const upload = useCallback(
		async (file: File | undefined) => {
			if (file === undefined || state.type === "loading" || !claim("import")) {
				return;
			}
			setActionError(undefined);
			try {
				const arkpack = await importFile(file);
				await navigate({
					to: "/action/load-game/$packageId",
					params: {
						packageId: arkpack.packageId,
					},
				});
			} catch (error) {
				if (mountedRef.current) setActionError(error);
			} finally {
				release("import");
				if (mountedRef.current) {
					if (inputRef.current !== null) inputRef.current.value = "";
				}
			}
		},
		[
			claim,
			importFile,
			navigate,
			release,
			state.type,
		],
	);

	const runBusyAction = useCallback(
		(action: Exclude<BusyAction, "import">, operation: () => Promise<unknown>) => {
			if (state.type === "loading" || !claim(action)) return;
			setActionError(undefined);
			void operation()
				.catch((error: unknown) => {
					if (mountedRef.current) setActionError(error);
				})
				.finally(() => release(action));
		},
		[
			claim,
			release,
			state.type,
		],
	);

	const removeArkpack = useCallback(
		(packageId: string) => runBusyAction("remove", () => remove(packageId)),
		[
			remove,
			runBusyAction,
		],
	);

	const refreshArkpacks = useCallback(
		() => runBusyAction("refresh", () => refresh()),
		[
			refresh,
			runBusyAction,
		],
	);

	const openArkpackDirectory = useCallback(
		() => runBusyAction("open-directory", () => openUserDirectory()),
		[
			openUserDirectory,
			runBusyAction,
		],
	);

	const openArkpackInEditor = useCallback(
		(packageId: string) =>
			runBusyAction("editor", async () => {
				const project = await openEditor(packageId);
				await navigate({
					to: "/editor/$projectId/editor/items/list",
					params: {
						projectId: project.projectId,
					},
				});
			}),
		[
			navigate,
			openEditor,
			runBusyAction,
		],
	);

	return {
		state,
		inputRef,
		blocked: active !== null || state.type === "loading",
		actionError,
		upload,
		removeArkpack,
		openArkpackInEditor,
		refreshArkpacks,
		openArkpackDirectory,
		requestMainMenu,
	};
};
