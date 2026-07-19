import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useArkpacks } from "~/bridge/arkpack/useArkpacks";
import { DangerButton, PrimaryButton, PrimaryButtonLink } from "~/ui/button/Button";

/** Selects a bundled or locally imported game package without uploading it anywhere. */
export const ArkpackSelector = () => {
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

	const upload = async (file: File | undefined) => {
		if (file === undefined) return;
		setBusy(true);
		setActionError(undefined);
		try {
			const arkpack = await importFile(file);
			await navigate({
				to: "/game/$packageId",
				params: {
					packageId: arkpack.packageId,
				},
			});
		} catch (error) {
			setActionError(error);
		} finally {
			setBusy(false);
			if (inputRef.current !== null) inputRef.current.value = "";
		}
	};

	return (
		<div
			className="grid h-full min-h-0 w-full grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-[clamp(0.75rem,2.5vmin,2rem)]"
			data-ui="ArkpackSelector"
		>
			<header>
				<p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
					Arkini arkpacks
				</p>
				<h1
					id="arkpack-selector-title"
					className="mt-2 text-[clamp(1.5rem,4vmin,1.875rem)] font-semibold"
				>
					Choose a game package
				</h1>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
					Imported arkpacks stay on this device. Every package is validated before it can
					run.
				</p>
			</header>

			<section className="rounded-2xl border border-line bg-surface/80 p-4">
				<input
					ref={inputRef}
					type="file"
					accept=".arkpack,application/octet-stream"
					className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:font-semibold file:text-accent-contrast hover:file:bg-accent-hover"
					disabled={busy || exitPending}
					onChange={(event) => void upload(event.currentTarget.files?.[0])}
				/>
				{busy ? <p className="mt-3 text-sm text-accent">Validating package…</p> : null}
				{actionError === undefined ? null : (
					<p className="mt-3 text-sm text-danger">{String(actionError)}</p>
				)}
			</section>

			<section className="scrollbar-hidden grid min-h-0 content-start gap-3 overflow-y-auto overscroll-contain">
				{state.type === "loading" ? (
					<p className="text-sm text-muted">Reading local packages…</p>
				) : state.type === "failed" ? (
					<p className="text-sm text-danger">
						Package catalog failed: {String(state.error)}
					</p>
				) : (
					state.arkpacks.map((arkpack) => (
						<article
							key={arkpack.packageId}
							className="flex min-w-0 flex-col items-stretch justify-between gap-4 rounded-2xl border border-line bg-surface/80 p-4 sm:flex-row sm:items-center"
						>
							<div className="min-w-0">
								<div className="flex items-center gap-2">
									<h2 className="truncate text-lg font-semibold">
										{arkpack.title}
									</h2>
									<span className="rounded-full bg-surface-raised px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
										{arkpack.source === "built-in" ? "Official" : "Local"}
									</span>
								</div>
								<p className="mt-1 truncate text-xs text-subtle">
									{arkpack.filename ??
										`${arkpack.gameId} · config ${arkpack.configVersion}`}
								</p>
							</div>
							<div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0">
								{arkpack.source === "imported" ? (
									<DangerButton
										className="min-h-0 px-3 py-2 text-xs shadow-none"
										onClick={() =>
											void remove(arkpack.packageId).catch(setActionError)
										}
									>
										Remove
									</DangerButton>
								) : null}
								<PrimaryButtonLink
									to="/game/$packageId"
									params={{
										packageId: arkpack.packageId,
									}}
									className="min-h-0 px-4 py-2 text-sm shadow-none"
								>
									Play
								</PrimaryButtonLink>
							</div>
						</article>
					))
				)}
			</section>

			<footer className="flex justify-center pb-[env(safe-area-inset-bottom)]">
				<PrimaryButton
					disabled={busy || exitPending}
					onClick={requestMainMenu}
				>
					{exitPending ? "Returning…" : "Return to main menu"}
				</PrimaryButton>
			</footer>
		</div>
	);
};
