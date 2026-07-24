import { useAtomSet } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { importArkpackFileAtom } from "~/bridge/arkpack/importArkpackFileAtom";
import { removeArkpackAtom } from "~/bridge/arkpack/removeArkpackAtom";
import { useArkpacks } from "~/bridge/arkpack/useArkpacks";
import { useExclusiveAction } from "~/ui/action/useExclusiveAction";

type BusyAction = "import" | "remove";
type ActiveAction = BusyAction | "exit";

/** Owns Arkpack import, removal, exit navigation, mounted guards, and Escape lifecycle. */
export const useArkpackSelectorActions = () => {
	const { state } = useArkpacks();
	// TODO(#397): Revalidate stable promise-mode ownership, rejection, and interruption
	// semantics; keep it only while this mounted selector owns the complete async action.
	// Promise-mode command results are atom-wide, so the selector claims one exclusive action
	// before invoking either setter and never overlaps awaited import/remove calls.
	const importFile = useAtomSet(importArkpackFileAtom, {
		mode: "promise",
	});
	const remove = useAtomSet(removeArkpackAtom, {
		mode: "promise",
	});
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const mountedRef = useRef(false);
	const [actionError, setActionError] = useState<unknown>();
	const { active, claim, release } = useExclusiveAction<ActiveAction>();
	const busyAction: BusyAction | null =
		active === "import" || active === "remove" ? active : null;
	const exitPending = active === "exit";

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

	const removeArkpack = useCallback(
		(packageId: string) => {
			if (state.type === "loading" || !claim("remove")) return;
			setActionError(undefined);
			void (async () => {
				try {
					await remove(packageId);
				} catch (error) {
					if (mountedRef.current) setActionError(error);
				} finally {
					release("remove");
				}
			})();
		},
		[
			claim,
			release,
			remove,
			state.type,
		],
	);

	return {
		state,
		inputRef,
		busyAction,
		blocked: busyAction !== null || exitPending || state.type === "loading",
		exitPending,
		actionError,
		upload,
		removeArkpack,
		requestMainMenu,
	};
};
