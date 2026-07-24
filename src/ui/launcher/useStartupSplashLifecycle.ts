import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Cause } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";
import { match, P } from "ts-pattern";

import { completeLauncherSplashAtom } from "~/ui/launcher/completeLauncherSplashAtom";
import { LauncherStartupAtom } from "~/ui/launcher/LauncherStartupAtom";
import { LauncherVisualReadyAtom } from "~/ui/launcher/LauncherVisualReadyAtom";
import { retryLauncherStartupAtom } from "~/ui/launcher/retryLauncherStartupAtom";

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

/** Owns native visibility timing, startup completion, Escape, retry, and navigation. */
export const useStartupSplashLifecycle = () => {
	const startup = useAtomValue(LauncherStartupAtom);
	const visualReady = useAtomValue(LauncherVisualReadyAtom);
	const completeSplash = useAtomSet(completeLauncherSplashAtom);
	const retryStartup = useAtomSet(retryLauncherStartupAtom);
	const navigate = useNavigate();
	const [visibleAtMs, setVisibleAtMs] = useState<number | null>(null);
	const [blackHoldComplete, setBlackHoldComplete] = useState(false);
	const [minimumSplashComplete, setMinimumSplashComplete] = useState(false);
	const [navigationError, setNavigationError] = useState<unknown | null>(null);
	const navigationStartedRef = useRef(false);
	const canContinue =
		startup._tag === "Success" && !startup.waiting && blackHoldComplete && visualReady;

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
		setNavigationError(null);
		void navigate({
			to: "/main-menu",
			replace: true,
		})
			.then(() => {
				completeSplash();
			})
			.catch((error) => {
				navigationStartedRef.current = false;
				setNavigationError(error);
			});
	}, [
		canContinue,
		completeSplash,
		navigate,
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
		if (navigationError !== null) {
			complete();
			return;
		}
		retryStartup();
	}, [
		complete,
		navigationError,
		retryStartup,
	]);

	const content: useStartupSplashLifecycle.Content =
		navigationError === null
			? startup.waiting
				? {
						kind: "loading",
					}
				: match(startup)
						.with(
							{
								_tag: "Initial",
							},
							(): useStartupSplashLifecycle.Content => ({
								kind: "loading",
							}),
						)
						.with(
							{
								_tag: "Failure",
							},
							({ cause }): useStartupSplashLifecycle.Content => {
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
						.exhaustive()
			: {
					kind: "failure",
					message:
						navigationError instanceof Error
							? navigationError.message
							: String(navigationError),
				};

	const view = match([
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
			(): useStartupSplashLifecycle.View => ({
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
			(): useStartupSplashLifecycle.View => ({
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
			([, , , failed]): useStartupSplashLifecycle.View => {
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
