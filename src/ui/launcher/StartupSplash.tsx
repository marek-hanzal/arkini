import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { PrimaryButton } from "~/ui/button/Button";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { useLauncherStartup } from "~/ui/launcher/useLauncherStartup";
import { startupContentViewTransitionName } from "~/ui/navigation/startupContentViewTransitionName";

const blackHoldMs = 500;
const minimumSplashMs = 5_000;

const messageFromError = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

/** Owns the one visible startup page before native navigation hands off to the launcher. */
export const StartupSplash = () => {
	const startup = useLauncherStartup();
	const state = useSyncExternalStore(startup.subscribe, startup.getSnapshot, startup.getSnapshot);
	const navigate = useNavigate();
	const [visibleAtMs, setVisibleAtMs] = useState<number | null>(null);
	const [blackHoldComplete, setBlackHoldComplete] = useState(false);
	const [minimumSplashComplete, setMinimumSplashComplete] = useState(false);
	const navigationStartedRef = useRef(false);
	const visualReady = state.appearance !== null && state.heroReady;
	const canContinue = state.type === "ready" && blackHoldComplete && visualReady;

	useEffect(() => {
		let active = true;
		void window.arkini.lifecycle
			.waitUntilVisible()
			.then((nextVisibleAtMs) => {
				if (active) setVisibleAtMs(nextVisibleAtMs);
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (visibleAtMs === null) return;
		const elapsedMs = performance.now() - visibleAtMs;
		const blackTimer = window.setTimeout(
			() => setBlackHoldComplete(true),
			Math.max(0, blackHoldMs - elapsedMs),
		);
		const minimumTimer = window.setTimeout(
			() => setMinimumSplashComplete(true),
			Math.max(0, minimumSplashMs - elapsedMs),
		);
		return () => {
			window.clearTimeout(blackTimer);
			window.clearTimeout(minimumTimer);
		};
	}, [
		visibleAtMs,
	]);

	const complete = useCallback(() => {
		if (!canContinue || navigationStartedRef.current) return;
		navigationStartedRef.current = true;
		void RendererRuntime.runPromise(startup.completeSplashFx)
			.then(() =>
				navigate({
					to: "/main-menu",
					replace: true,
				}),
			)
			.catch(() => {
				navigationStartedRef.current = false;
			});
	}, [
		canContinue,
		navigate,
		startup,
	]);

	useEffect(() => {
		if (!minimumSplashComplete) return;
		complete();
	}, [
		complete,
		minimumSplashComplete,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || !canContinue || minimumSplashComplete) return;
			event.preventDefault();
			complete();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		canContinue,
		complete,
		minimumSplashComplete,
	]);

	const retry = () => {
		void RendererRuntime.runPromise(startup.retryFx).catch(() => undefined);
	};

	if (!blackHoldComplete || (!visualReady && state.type !== "failed")) {
		return (
			<main
				className="size-full bg-black"
				data-ui="StartupBlackHold"
			/>
		);
	}

	if (state.type === "failed" && !visualReady) {
		return (
			<main
				className="grid size-full place-items-center bg-black p-6 text-white"
				data-ui="StartupFailure"
			>
				<div className="grid max-w-lg gap-3 rounded-2xl border border-danger/35 bg-surface p-4 text-center text-foreground shadow-xl">
					<p className="font-semibold text-danger">Startup failed</p>
					<p>{messageFromError(state.error)}</p>
					<PrimaryButton
						className="mx-auto"
						onClick={retry}
					>
						Retry
					</PrimaryButton>
				</div>
			</main>
		);
	}

	return (
		<LauncherScene dataUi="StartupSplash">
			<div
				className="min-h-14 text-center text-sm text-muted"
				aria-live="polite"
				data-ui="StartupSplashContent"
				style={{
					viewTransitionName: startupContentViewTransitionName,
				}}
			>
				{state.type === "loading" ? (
					<p>Preparing Arkini…</p>
				) : state.type === "failed" ? (
					<div className="mx-auto grid max-w-lg gap-3 rounded-2xl border border-danger/35 bg-surface p-4 shadow-xl">
						<p className="font-semibold text-danger">Startup failed</p>
						<p>{messageFromError(state.error)}</p>
						<PrimaryButton
							className="mx-auto"
							onClick={retry}
						>
							Retry
						</PrimaryButton>
					</div>
				) : !minimumSplashComplete ? (
					<p className="text-xs font-semibold uppercase tracking-[0.24em] text-subtle">
						Press Esc to continue
					</p>
				) : null}
			</div>
		</LauncherScene>
	);
};
