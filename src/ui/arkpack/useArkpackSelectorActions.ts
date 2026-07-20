import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useArkpacks } from "~/bridge/arkpack/useArkpacks";

/** Owns Arkpack import, removal, exit navigation, mounted guards, and Escape lifecycle. */
export const useArkpackSelectorActions = () => {
	const { state, importFile, remove } = useArkpacks();
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);
	const mountedRef = useRef(false);
	const exitPendingRef = useRef(false);
	const [busy, setBusy] = useState(false);
	const [exitPending, setExitPending] = useState(false);
	const [actionError, setActionError] = useState<unknown>();

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const requestMainMenu = useCallback(() => {
		if (busy || exitPendingRef.current) return;
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
		busy,
		navigate,
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
			if (file === undefined) return;
			setBusy(true);
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
				if (mountedRef.current) {
					setBusy(false);
					if (inputRef.current !== null) inputRef.current.value = "";
				}
			}
		},
		[
			importFile,
			navigate,
		],
	);

	const removeArkpack = useCallback(
		(packageId: string) => {
			setActionError(undefined);
			void remove(packageId).catch((error) => {
				if (mountedRef.current) setActionError(error);
			});
		},
		[
			remove,
		],
	);

	return {
		state,
		inputRef,
		busy,
		exitPending,
		actionError,
		upload,
		removeArkpack,
		requestMainMenu,
	};
};
