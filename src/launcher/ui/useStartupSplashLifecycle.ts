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
			readonly kind: "loading";
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
	const [minimumSplashComplete, setMinimumSplashCompleteFn] = useState(false);
	const [visibilityError, setVisibilityErrorFn] = useState<unknown | null>(null);
	const [visibilityAttempt, setVisibilityAttemptFn] = useState(0);
	const [navigationError, setNavigationErrorFn] = useState<unknown | null>(null);
	const navigationStartedRef = useRef(false);
	const splashReady = visibleAtMs !== null && visualReady;
	const canContinue = startup._tag === "Success" && !startup.waiting && splashReady;

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
		if (!splashReady) return;
		const minimumTimer = window.setTimeout(
			() => setMinimumSplashCompleteFn(true),
			minimumSplashMs,
		);
		return () => {
			window.clearTimeout(minimumTimer);
		};
	}, [
		splashReady,
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
	const content = match({
		lifecycleError,
		startup,
		minimumSplashComplete,
	})
		.returnType<StartupSplashContent>()
		.with(
			{
				lifecycleError: P.not(null),
			},
			({ lifecycleError }) => ({
				kind: "failure",
				message:
					lifecycleError instanceof Error
						? lifecycleError.message
						: String(lifecycleError),
			}),
		)
		.with(
			{
				startup: {
					waiting: true,
				},
			},
			{
				startup: {
					_tag: "Initial",
				},
			},
			() => ({
				kind: "loading",
			}),
		)
		.with(
			{
				startup: {
					_tag: "Failure",
				},
			},
			({ startup }) => {
				const error = Cause.squash(startup.cause);
				return {
					kind: "failure",
					message: error instanceof Error ? error.message : String(error),
				};
			},
		)
		.with(
			{
				startup: {
					_tag: "Success",
				},
				minimumSplashComplete: true,
			},
			() => ({
				kind: "empty",
			}),
		)
		.with(
			{
				startup: {
					_tag: "Success",
				},
				minimumSplashComplete: false,
			},
			() => ({
				kind: "prompt",
			}),
		)
		.exhaustive();

	const view = match({
		visibilityError,
		startup,
		visualReady,
		splashReady,
	})
		.returnType<StartupSplashView>()
		.with(
			{
				visibilityError: P.not(null),
			},
			({ visibilityError }) => ({
				kind: "failure",
				message:
					visibilityError instanceof Error
						? visibilityError.message
						: String(visibilityError),
			}),
		)
		.with(
			{
				startup: {
					_tag: "Failure",
					waiting: false,
				},
				visualReady: false,
			},
			({ startup }) => {
				const error = Cause.squash(startup.cause);
				return {
					kind: "failure",
					message: error instanceof Error ? error.message : String(error),
				};
			},
		)
		.with(
			{
				splashReady: true,
			},
			() => ({
				kind: "scene",
				content,
			}),
		)
		.otherwise(() => ({
			kind: "loading",
		}));

	return {
		skipFn: completeFn,
		view,
		retryFn,
	};
};
