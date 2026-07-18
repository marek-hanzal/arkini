import { useNavigate } from "@tanstack/react-router";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { PrimaryButton } from "~/ui/button/Button";
import { LauncherScene } from "~/ui/launcher/LauncherScene";
import { useLauncherStartup } from "~/ui/launcher/useLauncherStartup";

const blackHoldMs = 500;
const minimumSplashMs = 5_000;
const enterTransitionMs = 700;
const exitTransitionMs = 650;

type SplashPhase = "black" | "entering" | "open" | "exiting" | "completed";

const messageFromError = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

const currentFrame = (element: HTMLElement) => {
	const style = getComputedStyle(element);
	return {
		opacity: style.opacity,
		transform: style.transform === "none" ? "scale(1)" : style.transform,
		filter: style.filter === "none" ? "blur(0px)" : style.filter,
	};
};

/** Runs the visible-window black hold, decoded Hero reveal and real main-menu cross-fade. */
export const StartupSplash = () => {
	const startup = useLauncherStartup();
	const state = useSyncExternalStore(startup.subscribe, startup.getSnapshot, startup.getSnapshot);
	const navigate = useNavigate();
	const [visibleAtMs, setVisibleAtMs] = useState<number | null>(null);
	const [blackHoldComplete, setBlackHoldComplete] = useState(false);
	const [phase, setPhase] = useState<SplashPhase>("black");
	const overlayRef = useRef<HTMLDivElement>(null);
	const animationRef = useRef<Animation | undefined>(undefined);
	const animationGenerationRef = useRef(0);
	const exitRequestedRef = useRef(false);
	const visualReady = state.appearance !== null && state.heroReady;

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
		const remainingMs = Math.max(0, blackHoldMs - (performance.now() - visibleAtMs));
		const timer = window.setTimeout(() => setBlackHoldComplete(true), remainingMs);
		return () => window.clearTimeout(timer);
	}, [
		visibleAtMs,
	]);

	useEffect(() => {
		if (phase !== "black" || !blackHoldComplete || !visualReady) return;
		setPhase("entering");
	}, [
		blackHoldComplete,
		phase,
		visualReady,
	]);

	const requestExit = useCallback(() => {
		if (state.type !== "ready" || phase === "completed" || phase === "exiting") return;
		if (phase === "open") {
			setPhase("exiting");
			return;
		}
		exitRequestedRef.current = true;
	}, [
		phase,
		state.type,
	]);

	useEffect(() => {
		if (visibleAtMs === null || state.type !== "ready") return;
		const remainingMs = Math.max(0, minimumSplashMs - (performance.now() - visibleAtMs));
		const timer = window.setTimeout(requestExit, remainingMs);
		return () => window.clearTimeout(timer);
	}, [
		requestExit,
		state.type,
		visibleAtMs,
	]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || state.type !== "ready") return;
			event.preventDefault();
			requestExit();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		requestExit,
		state.type,
	]);

	useLayoutEffect(() => {
		if (phase !== "entering" && phase !== "exiting") return;
		const overlay = overlayRef.current;
		if (overlay === null) return;
		const generation = animationGenerationRef.current + 1;
		animationGenerationRef.current = generation;
		const frame = currentFrame(overlay);
		animationRef.current?.cancel();

		if (typeof overlay.animate !== "function") {
			if (phase === "entering") {
				setPhase(exitRequestedRef.current ? "exiting" : "open");
			} else {
				setPhase("completed");
			}
			return;
		}

		const entering = phase === "entering";
		const animation = overlay.animate(
			entering
				? [
						{
							opacity: 0,
							transform: "scale(0.985)",
							filter: "blur(8px)",
						},
						{
							opacity: 1,
							transform: "scale(1)",
							filter: "blur(0px)",
						},
					]
				: [
						frame,
						{
							opacity: 0,
							transform: "scale(1.01)",
							filter: "blur(8px)",
						},
					],
			{
				duration: entering ? enterTransitionMs : exitTransitionMs,
				easing: entering
					? "cubic-bezier(0.22, 1, 0.36, 1)"
					: "cubic-bezier(0.64, 0, 0.78, 0)",
				fill: "both",
			},
		);
		animationRef.current = animation;
		void animation.finished
			.catch(() => undefined)
			.then(() => {
				if (animationGenerationRef.current !== generation) return;
				animation.cancel();
				animationRef.current = undefined;
				if (phase === "entering") {
					setPhase(exitRequestedRef.current ? "exiting" : "open");
					return;
				}
				setPhase("completed");
			});
	}, [
		phase,
	]);

	useEffect(() => {
		if (phase !== "completed") return;
		void RendererRuntime.runPromise(startup.completeSplashFx).then(() =>
			navigate({
				to: "/main-menu",
				viewTransition: false,
			}),
		);
	}, [
		navigate,
		phase,
		startup,
	]);

	useEffect(
		() => () => {
			animationGenerationRef.current += 1;
			animationRef.current?.cancel();
			animationRef.current = undefined;
		},
		[],
	);

	const retry = () => {
		void RendererRuntime.runPromise(startup.retryFx).catch(() => undefined);
	};

	if (phase === "completed") return null;

	if (!blackHoldComplete || (!visualReady && state.type !== "failed")) {
		return (
			<main
				className="absolute inset-0 z-20 size-full bg-black"
				data-ui="StartupBlackHold"
			/>
		);
	}

	if (state.type === "failed" && !visualReady) {
		return (
			<main
				className="absolute inset-0 z-20 grid size-full place-items-center bg-black p-6 text-white"
				data-ui="StartupFailure"
			>
				<div className="grid max-w-lg gap-3 rounded-2xl border border-danger/35 bg-surface/85 p-4 text-center text-foreground shadow-xl backdrop-blur-md">
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
		<div
			ref={overlayRef}
			className="absolute inset-0 z-20 size-full"
			data-ui="StartupSplash"
			data-phase={phase}
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
							<PrimaryButton
								className="mx-auto"
								onClick={retry}
							>
								Retry
							</PrimaryButton>
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
