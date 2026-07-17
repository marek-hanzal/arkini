import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { useLauncherStartup } from "~/ui/launcher/useLauncherStartup";
import { usePrefersReducedMotion } from "~/ui/launcher/usePrefersReducedMotion";

const blackHoldMs = 500;
const minimumSplashMs = 5_000;
const exitTransitionMs = 650;

const messageFromError = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

/** Runs the one-session black hold, bootstrap splash, skip, retry and exit transition. */
export const StartupSplash = () => {
	const startup = useLauncherStartup();
	const state = useSyncExternalStore(startup.subscribe, startup.getSnapshot, startup.getSnapshot);
	const navigate = useNavigate();
	const reducedMotion = usePrefersReducedMotion();
	const [sceneVisible, setSceneVisible] = useState(false);
	const [exiting, setExiting] = useState(false);
	const transitionStarted = useRef(false);
	const exitTimer = useRef<number | undefined>(undefined);

	useEffect(() => {
		const elapsed = performance.now() - startup.startedAtMs;
		const timer = window.setTimeout(
			() => setSceneVisible(true),
			Math.max(0, blackHoldMs - elapsed),
		);
		return () => window.clearTimeout(timer);
	}, [
		startup.startedAtMs,
	]);

	const beginExit = useCallback(() => {
		if (transitionStarted.current || state.type !== "ready" || !sceneVisible) return;
		transitionStarted.current = true;
		setExiting(true);
		const delay = reducedMotion ? 0 : exitTransitionMs;
		exitTimer.current = window.setTimeout(() => {
			void RendererRuntime.runPromise(startup.completeSplashFx).then(() =>
				navigate({
					to: "/main-menu",
				}),
			);
		}, delay);
	}, [
		navigate,
		reducedMotion,
		sceneVisible,
		startup,
		state.type,
	]);

	useEffect(() => {
		if (!sceneVisible || state.type !== "ready" || transitionStarted.current) return;
		const elapsed = performance.now() - startup.startedAtMs;
		const timer = window.setTimeout(beginExit, Math.max(0, minimumSplashMs - elapsed));
		return () => window.clearTimeout(timer);
	}, [
		beginExit,
		sceneVisible,
		startup.startedAtMs,
		state.type,
	]);

	useEffect(
		() => () => {
			if (exitTimer.current !== undefined) window.clearTimeout(exitTimer.current);
		},
		[],
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || state.type !== "ready" || !sceneVisible) return;
			event.preventDefault();
			beginExit();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		beginExit,
		sceneVisible,
		state.type,
	]);

	if (!sceneVisible) {
		return (
			<main
				className="size-full bg-black"
				data-ui="StartupBlackHold"
			/>
		);
	}

	const retry = () => {
		void RendererRuntime.runPromise(startup.retryFx).catch(() => undefined);
	};

	return (
		<div
			className={exiting ? "launcher-splash launcher-splash--exiting" : "launcher-splash"}
			data-ui="StartupSplash"
		>
			<LauncherScene dataUi="StartupSplashScene">
				<div
					className="min-h-14 text-center text-sm text-muted"
					aria-live="polite"
				>
					{state.type === "loading" ? (
						<p>Preparing Arkini…</p>
					) : state.type === "failed" ? (
						<div className="mx-auto grid max-w-lg gap-3 rounded-2xl border border-danger/35 bg-surface/85 p-4 shadow-xl backdrop-blur-md">
							<p className="font-semibold text-danger">Startup failed</p>
							<p>{messageFromError(state.error)}</p>
							<button
								type="button"
								className="mx-auto rounded-lg bg-accent px-4 py-2 font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
								onClick={retry}
							>
								Retry
							</button>
						</div>
					) : (
						<p className="animate-pulse text-xs font-semibold uppercase tracking-[0.24em] text-subtle">
							Press Esc to continue
						</p>
					)}
				</div>
			</LauncherScene>
		</div>
	);
};
