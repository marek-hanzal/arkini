import {
	type PropsWithChildren,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { flushSync } from "react-dom";
import type { ActionLoadingControl } from "~/ui/loading/ActionLoadingControl";
import { ActionLoadingContext } from "~/ui/loading/ActionLoadingContext";
import {
	ActionLoadingScreen,
	defaultLoadingCompletedHoldMs,
	defaultLoadingMinimumDurationMs,
} from "~/ui/loading/ActionLoadingScreen";

type Deferred = {
	readonly promise: Promise<void>;
	readonly reject: (error: unknown) => void;
	readonly resolve: () => void;
};

const deferred = (): Deferred => {
	let resolve: () => void = () => undefined;
	let reject: (error: unknown) => void = () => undefined;
	const promise = new Promise<void>((complete, fail) => {
		resolve = complete;
		reject = fail;
	});
	return { promise, reject, resolve };
};

interface ActiveAction {
	readonly action: Promise<void>;
	readonly completedHoldMs: number;
	readonly generation: number;
	readonly key: string;
	readonly label: string;
	readonly minimumDurationMs: number;
	readonly mode: "normal" | "native-close";
	readonly presentation: Deferred;
	readonly result: Deferred;
	readonly signalNativeCloseReady?: Deferred;
}

const activeNativeViewTransitionAnimations = () => {
	if (typeof document.getAnimations !== "function") return [];
	return document.getAnimations().filter((animation) => {
		const effect = animation.effect as
			| (AnimationEffect & { readonly pseudoElement?: string })
			| null;
		return effect?.pseudoElement?.startsWith("::view-transition-") === true;
	});
};

const waitForActiveNativeViewTransitions = async () => {
	const animations = activeNativeViewTransitionAnimations();
	if (animations.length === 0) return;
	await Promise.allSettled(animations.map((animation) => animation.finished));
};

export namespace ActionLoadingProvider {
	export interface Props extends PropsWithChildren {
		readonly completedHoldMs?: number;
		readonly minimumDurationMs?: number;
	}
}

/** Owns one cross-route loading presentation over existing authoritative actions. */
export const ActionLoadingProvider = ({
	children,
	completedHoldMs: defaultCompletedHoldMs = defaultLoadingCompletedHoldMs,
	minimumDurationMs: defaultMinimumDurationMs = defaultLoadingMinimumDurationMs,
}: ActionLoadingProvider.Props) => {
	const [active, setActive] = useState<ActiveAction | null>(null);
	const activeRef = useRef<ActiveAction | null>(null);
	const generationRef = useRef(0);
	const mountedRef = useRef(false);
	const overlayRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	activeRef.current = active;

	const replaceActive = useCallback((entry: ActiveAction) => {
		const previous = activeRef.current;
		if (previous === null) {
			previousFocusRef.current =
				document.activeElement instanceof HTMLElement ? document.activeElement : null;
		}
		if (previous !== null && previous !== entry) {
			void previous.action.then(previous.result.resolve, previous.result.reject);
			previous.presentation.resolve();
		}
		activeRef.current = entry;
		setActive(entry);
	}, []);

	const focusSettledSurface = useCallback((restoreSource: boolean) => {
		const previous = previousFocusRef.current;
		previousFocusRef.current = null;
		if (restoreSource && previous?.isConnected === true) {
			previous.focus({ preventScroll: true });
			return;
		}
		document
			.querySelector<HTMLElement>(
				'[data-ui="MainPagePanel"], [data-ui="GameShell"], [data-ui="MainPageLayout"], main',
			)
			?.focus({ preventScroll: true });
	}, []);

	const hide = useCallback(
		async (entry: ActiveAction, restoreSource: boolean) => {
			if (activeRef.current?.generation !== entry.generation) return;
			await waitForActiveNativeViewTransitions();
			if (activeRef.current?.generation !== entry.generation) return;
			const commit = () => {
				if (activeRef.current?.generation !== entry.generation) return;
				activeRef.current = null;
				flushSync(() => setActive(null));
			};
			if (typeof document.startViewTransition !== "function") {
				commit();
				focusSettledSurface(restoreSource);
				return;
			}
			try {
				const transition = document.startViewTransition(commit);
				await transition.finished.catch(() => undefined);
			} catch {
				commit();
			}
			focusSettledSurface(restoreSource);
		},
		[focusSettledSurface],
	);

	const createEntry = useCallback(
		({
			action,
			completedHoldMs = defaultCompletedHoldMs,
			key,
			label,
			minimumDurationMs = defaultMinimumDurationMs,
			mode,
			signalNativeCloseReady,
		}: ActionLoadingControl.RunOptions & {
			readonly mode: ActiveAction["mode"];
			readonly signalNativeCloseReady?: Deferred;
		}) => {
			const result = deferred();
			const presentation = deferred();
			const actionPromise = Promise.resolve().then(action);
			void actionPromise.catch(() => undefined);
			return {
				action: actionPromise,
				completedHoldMs,
				generation: generationRef.current + 1,
				key,
				label,
				minimumDurationMs,
				mode,
				presentation,
				result,
				signalNativeCloseReady,
			} satisfies ActiveAction;
		},
		[defaultCompletedHoldMs, defaultMinimumDurationMs],
	);

	const createNativeCloseEntry = useCallback(
		(options: Omit<ActionLoadingControl.RunOptions, "action">) => {
			const signalNativeCloseReady = deferred();
			const entry = createEntry({
				...options,
				action: () => signalNativeCloseReady.promise,
				mode: "native-close",
				signalNativeCloseReady,
			});
			generationRef.current = entry.generation;
			replaceActive(entry);
			return entry;
		},
		[createEntry, replaceActive],
	);

	const run = useCallback<ActionLoadingControl.Type["run"]>(
		(options) => {
			const current = activeRef.current;
			if (current?.key === options.key) return current.result.promise;
			if (current?.mode === "native-close") return current.result.promise;
			const entry = createEntry({ ...options, mode: "normal" });
			generationRef.current = entry.generation;
			replaceActive(entry);
			return entry.result.promise;
		},
		[createEntry, replaceActive],
	);

	const runNativeClose = useCallback<ActionLoadingControl.Type["runNativeClose"]>(
		(options) => {
			const current = activeRef.current;
			if (current !== null) return current.result.promise;
			const entry = createNativeCloseEntry(options);
			void Promise.resolve()
				.then(options.action)
				.then(entry.result.resolve)
				.catch((error) => entry.signalNativeCloseReady?.reject(error));
			return entry.result.promise;
		},
		[createNativeCloseEntry],
	);

	useEffect(() => {
		const removeBeforeClose = window.arkini.lifecycle.onBeforeClose?.(() => {
			if (activeRef.current?.mode === "native-close") return Promise.resolve();
			createNativeCloseEntry({
				key: "native-close:title-bar",
				label: "Saving and exiting Arkini…",
			});
			return Promise.resolve();
		});
		return removeBeforeClose;
	}, [createNativeCloseEntry]);

	useEffect(() => {
		const removeBeforeCloseReady = window.arkini.lifecycle.onBeforeCloseReady?.(() => {
			const current = activeRef.current;
			if (current?.mode !== "native-close") return Promise.resolve();
			current.signalNativeCloseReady?.resolve();
			return current.presentation.promise;
		});
		return removeBeforeCloseReady;
	}, []);

	useEffect(() => {
		const removeCloseFailed = window.arkini.lifecycle.onCloseFailed?.((error) => {
			const current = activeRef.current;
			if (current?.mode !== "native-close") return;
			current.signalNativeCloseReady?.reject(error);
		});
		return removeCloseFailed;
	}, []);

	useLayoutEffect(() => {
		if (active === null) return;
		overlayRef.current?.focus({ preventScroll: true });
	}, [active]);

	useEffect(() => {
		if (active === null) return;
		const blockInput = (event: KeyboardEvent) => {
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		window.addEventListener("keydown", blockInput, true);
		return () => window.removeEventListener("keydown", blockInput, true);
	}, [active]);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			queueMicrotask(() => {
				if (mountedRef.current) return;
				const current = activeRef.current;
				current?.presentation.resolve();
				activeRef.current = null;
			});
		};
	}, []);

	const complete = useCallback(
		(entry: ActiveAction) => {
			if (activeRef.current?.generation !== entry.generation) return;
			if (entry.mode === "native-close") {
				entry.presentation.resolve();
				return;
			}
			void hide(entry, false).then(() => {
				entry.presentation.resolve();
				entry.result.resolve();
			});
		},
		[hide],
	);

	const fail = useCallback(
		(entry: ActiveAction, error: unknown) => {
			if (activeRef.current?.generation !== entry.generation) {
				entry.result.reject(error);
				return;
			}
			void hide(entry, true).then(() => {
				entry.presentation.resolve();
				entry.result.reject(error);
			});
		},
		[hide],
	);

	const control = useMemo<ActionLoadingControl.Type>(
		() => ({ active: active !== null, run, runNativeClose }),
		[active, run, runNativeClose],
	);

	return (
		<ActionLoadingContext.Provider value={control}>
			<div
				className="contents"
				data-action-loading-active={active === null ? undefined : "true"}
			>
				<div
					aria-hidden={active === null ? undefined : true}
					className="contents"
					data-ui="ActionLoadingContent"
					inert={active === null ? undefined : true}
				>
					{children}
				</div>
				{active === null ? null : (
					<div
						ref={overlayRef}
						aria-label={active.label}
						className="fixed inset-0 z-[100] size-full overflow-hidden outline-none"
						data-ui="ActionLoadingOverlay"
						role="status"
						tabIndex={-1}
					>
						<ActionLoadingScreen
							action={active.action}
							completedHoldMs={active.completedHoldMs}
							key={active.generation}
							label={active.label}
							minimumDurationMs={active.minimumDurationMs}
							onComplete={() => complete(active)}
							onError={(error) => fail(active, error)}
						/>
					</div>
				)}
			</div>
		</ActionLoadingContext.Provider>
	);
};
