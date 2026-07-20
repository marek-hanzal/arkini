import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { match, P } from "ts-pattern";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { useLauncherStartup } from "~/ui/launcher/useLauncherStartup";

const blackHoldMs = 500;
const minimumSplashMs = 5_000;

export namespace useStartupSplashLifecycle {
	export type Content =
		| {
				readonly kind: "loading";
		  }
		| {
				readonly kind: "failure";
				readonly message: string;
		  }
		| {
				readonly kind: "prompt";
		  }
		| {
				readonly kind: "empty";
		  };

	export type View =
		| {
				readonly kind: "black";
		  }
		| {
				readonly kind: "failure";
				readonly message: string;
		  }
		| {
				readonly kind: "scene";
				readonly content: Content;
		  };
}

const messageFromError = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

/** Owns native visibility timing, startup completion, Escape, retry, and navigation. */
export const useStartupSplashLifecycle = () => {
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
		if (minimumSplashComplete) complete();
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

	const retry = useCallback(() => {
		void RendererRuntime.runPromise(startup.retryFx).catch(() => undefined);
	}, [
		startup,
	]);

	const content = match(state)
		.with(
			{
				type: "loading",
			},
			(): useStartupSplashLifecycle.Content => ({
				kind: "loading",
			}),
		)
		.with(
			{
				type: "failed",
			},
			({ error }): useStartupSplashLifecycle.Content => ({
				kind: "failure",
				message: messageFromError(error),
			}),
		)
		.with(
			{
				type: "ready",
			},
			(): useStartupSplashLifecycle.Content =>
				match(minimumSplashComplete)
					.with(true, () => ({
						kind: "empty" as const,
					}))
					.with(false, () => ({
						kind: "prompt" as const,
					}))
					.exhaustive(),
		)
		.exhaustive();

	const view = match([
		blackHoldComplete,
		visualReady,
		state,
	] as const)
		.with(
			[
				false,
				P._,
				P._,
			],
			(): useStartupSplashLifecycle.View => ({
				kind: "black",
			}),
		)
		.with(
			[
				true,
				false,
				{
					type: "loading",
				},
			],
			[
				true,
				false,
				{
					type: "ready",
				},
			],
			(): useStartupSplashLifecycle.View => ({
				kind: "black",
			}),
		)
		.with(
			[
				true,
				false,
				{
					type: "failed",
				},
			],
			([, , failed]): useStartupSplashLifecycle.View => ({
				kind: "failure",
				message: messageFromError(failed.error),
			}),
		)
		.with(
			[
				true,
				true,
				P._,
			],
			(): useStartupSplashLifecycle.View => ({
				kind: "scene",
				content,
			}),
		)
		.exhaustive();

	return {
		view,
		retry,
	};
};
