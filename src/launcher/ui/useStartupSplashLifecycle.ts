import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Cause, Effect, Fiber } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";
import { match, P } from "ts-pattern";

import { RendererLifecycleOwnerAtom } from "~/application-runtime/atom/RendererLifecycleOwnerAtom";
import { RendererLifecycleUnavailableError } from "~/application-runtime/error/RendererLifecycleUnavailableError";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { completeLauncherSplashAtom } from "~/launcher/atom/completeLauncherSplashAtom";
import { LauncherStartupAtom } from "~/launcher/atom/LauncherStartupAtom";
import { LauncherVisualReadyAtom } from "~/launcher/atom/LauncherVisualReadyAtom";
import { retryLauncherStartupAtom } from "~/launcher/atom/retryLauncherStartupAtom";

const blackHoldMs = 500;
const minimumSplashMs = 5_000;

type StartupSplashContent =
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

type StartupSplashView =
	| {
			readonly kind: "black";
	  }
	| {
			readonly kind: "failure";
			readonly message: string;
	  }
	| {
			readonly kind: "scene";
			readonly content: StartupSplashContent;
	  };

/** Owns native visibility timing, startup completion, skip input, retry, and navigation. */
export const useStartupSplashLifecycle = () => {
	const startup = useAtomValue(LauncherStartupAtom);
	const visualReady = useAtomValue(LauncherVisualReadyAtom);
	const lifecycle = useAtomValue(RendererLifecycleOwnerAtom);
	const completeSplashFn = useAtomSet(completeLauncherSplashAtom);
	const retryStartupFn = useAtomSet(retryLauncherStartupAtom);
	const navigateFn = useNavigate();
	const [visibleAtMs, setVisibleAtMsFn] = useState<number | null>(null);
	const [blackHoldComplete, setBlackHoldCompleteFn] = useState(false);
	const [minimumSplashComplete, setMinimumSplashCompleteFn] = useState(false);
	const [visibilityError, setVisibilityErrorFn] = useState<unknown | null>(null);
	const [visibilityAttempt, setVisibilityAttemptFn] = useState(0);
	const [navigationError, setNavigationErrorFn] = useState<unknown | null>(null);
	const navigationStartedRef = useRef(false);
	const canContinue =
		startup._tag === "Success" && !startup.waiting && blackHoldComplete && visualReady;

	useEffect(() => {
		if (lifecycle === undefined) {
			setVisibilityErrorFn(new RendererLifecycleUnavailableError());
			return;
		}
		const fiber = RendererRuntime.runFork(
			lifecycle.waitUntilVisibleFx.pipe(
				Effect.match({
					onFailure: (error) => setVisibilityErrorFn(error),
					onSuccess: (nextVisibleAtMs) => setVisibleAtMsFn(nextVisibleAtMs),
				}),
			),
		);
		return () => {
			void RendererRuntime.runFork(Fiber.interrupt(fiber));
		};
	}, [
		lifecycle,
		visibilityAttempt,
	]);

	useEffect(() => {
		if (visibleAtMs === null) return;
		const elapsedMs = performance.now() - visibleAtMs;
		const blackTimer = window.setTimeout(
			() => setBlackHoldCompleteFn(true),
			Math.max(0, blackHoldMs - elapsedMs),
		);
		const minimumTimer = window.setTimeout(
			() => setMinimumSplashCompleteFn(true),
			Math.max(0, minimumSplashMs - elapsedMs),
		);
		return () => {
			window.clearTimeout(blackTimer);
			window.clearTimeout(minimumTimer);
		};
	}, [
		visibleAtMs,
	]);

	const completeFn = useCallback(() => {
		if (!canContinue || navigationStartedRef.current) return;
		navigationStartedRef.current = true;
		setNavigationErrorFn(null);
		void navigateFn({
			to: "/main-menu",
			replace: true,
		})
			.then(() => {
				completeSplashFn();
			})
			.catch((error) => {
				navigationStartedRef.current = false;
				setNavigationErrorFn(error);
			});
	}, [
		canContinue,
		completeSplashFn,
		navigateFn,
	]);

	useEffect(() => {
		if (minimumSplashComplete) completeFn();
	}, [
		completeFn,
		minimumSplashComplete,
	]);

	useEffect(() => {
		const onKeyDownFn = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || !canContinue || minimumSplashComplete) return;
			event.preventDefault();
			completeFn();
		};
		window.addEventListener("keydown", onKeyDownFn);
		return () => window.removeEventListener("keydown", onKeyDownFn);
	}, [
		canContinue,
		completeFn,
		minimumSplashComplete,
	]);

	const retryFn = useCallback(() => {
		if (visibilityError !== null) {
			setVisibilityErrorFn(null);
			setVisibilityAttemptFn((attempt) => attempt + 1);
			return;
		}
		if (navigationError !== null) {
			completeFn();
			return;
		}
		retryStartupFn();
	}, [
		completeFn,
		navigationError,
		retryStartupFn,
		visibilityError,
	]);

	const lifecycleError = visibilityError ?? navigationError;
	const content: StartupSplashContent =
		lifecycleError === null
			? startup.waiting
				? {
						kind: "loading",
					}
				: match(startup)
						.with(
							{
								_tag: "Initial",
							},
							(): StartupSplashContent => ({
								kind: "loading",
							}),
						)
						.with(
							{
								_tag: "Failure",
							},
							({ cause }): StartupSplashContent => {
								const error = Cause.squash(cause);
								return {
									kind: "failure",
									message: error instanceof Error ? error.message : String(error),
								};
							},
						)
						.with(
							{
								_tag: "Success",
							},
							(): StartupSplashContent =>
								match(minimumSplashComplete)
									.with(true, () => ({
										kind: "empty" as const,
									}))
									.with(false, () => ({
										kind: "prompt" as const,
									}))
									.exhaustive(),
						)
						.exhaustive()
			: {
					kind: "failure",
					message:
						lifecycleError instanceof Error
							? lifecycleError.message
							: String(lifecycleError),
				};

	const view: StartupSplashView =
		visibilityError === null
			? match([
					blackHoldComplete,
					visualReady,
					startup.waiting,
					startup,
				] as const)
					.with(
						[
							false,
							P._,
							P._,
							P._,
						],
						(): StartupSplashView => ({
							kind: "black",
						}),
					)
					.with(
						[
							true,
							false,
							true,
							P._,
						],
						[
							true,
							false,
							false,
							{
								_tag: "Initial",
							},
						],
						[
							true,
							false,
							false,
							{
								_tag: "Success",
							},
						],
						(): StartupSplashView => ({
							kind: "black",
						}),
					)
					.with(
						[
							true,
							false,
							false,
							{
								_tag: "Failure",
							},
						],
						([, , , failed]): StartupSplashView => {
							const error = Cause.squash(failed.cause);
							return {
								kind: "failure",
								message: error instanceof Error ? error.message : String(error),
							};
						},
					)
					.with(
						[
							true,
							true,
							P._,
							P._,
						],
						(): StartupSplashView => ({
							kind: "scene",
							content,
						}),
					)
					.exhaustive()
			: {
					kind: "failure",
					message:
						visibilityError instanceof Error
							? visibilityError.message
							: String(visibilityError),
				};

	return {
		skipFn: completeFn,
		view,
		retryFn,
	};
};
