import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useArkpacks } from "~/bridge/arkpack/useArkpacks";

type BusyAction = "import" | "remove";

/** Owns Arkpack import, removal, exit navigation, mounted guards, and Escape lifecycle. */
export const useArkpackSelectorActions = () => {
	const { state, importFile, remove } = useArkpacks();
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const mountedRef = useRef(false);
	const busyRef = useRef<BusyAction | null>(null);
	const exitPendingRef = useRef(false);
	const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
	const [exitPending, setExitPending] = useState(false);
	const [actionError, setActionError] = useState<unknown>();

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const requestMainMenu = useCallback(() => {
		if (busyRef.current !== null || exitPendingRef.current || state.type === "loading") return;
		exitPendingRef.current = true;
		setExitPending(true);
		setActionError(undefined);
		void navigate({
			to: "/main-menu",
		})
			.catch((error) => {
				if (mountedRef.current) setActionError(error);
			})
			.finally(() => {
				exitPendingRef.current = false;
				if (mountedRef.current) setExitPending(false);
			});
	}, [
		navigate,
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
			if (
				file === undefined ||
				busyRef.current !== null ||
				exitPendingRef.current ||
				state.type === "loading"
			) {
				return;
			}
			busyRef.current = "import";
			setBusyAction("import");
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
				busyRef.current = null;
				if (mountedRef.current) {
					setBusyAction(null);
					if (inputRef.current !== null) inputRef.current.value = "";
				}
			}
		},
		[
			importFile,
			navigate,
			state.type,
		],
	);

	const removeArkpack = useCallback(
		(packageId: string) => {
			if (busyRef.current !== null || exitPendingRef.current || state.type === "loading") {
				return;
			}
			busyRef.current = "remove";
			setBusyAction("remove");
			setActionError(undefined);
			void remove(packageId)
				.catch((error) => {
					if (mountedRef.current) setActionError(error);
				})
				.finally(() => {
					busyRef.current = null;
					if (mountedRef.current) setBusyAction(null);
				});
		},
		[
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
