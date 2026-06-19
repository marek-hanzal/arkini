import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import type { GameRuntimeStore } from "~/v0/play/runtime/GameRuntimeStore";

export interface GameRuntimeSaveStorage {
	save(save: GameSave): Promise<void>;
}

export namespace connectGameRuntimeSavePersistence {
	export interface Props {
		debounceMs?: number;
		onError?(error: unknown): void;
		storage: GameRuntimeSaveStorage;
		store: GameRuntimeStore;
	}

	export interface Handle {
		destroy(): Promise<void>;
		flush(): Promise<void>;
	}
}

const defaultOnError = (error: unknown) => {
	console.error(error);
};

/**
 * Debounced save persistence wrapper for the runtime store.
 *
 * This is deliberately outside `RuntimeGameEngineAdapter`: the engine owns gameplay
 * state transitions, storage owns durability. Dexie can implement the tiny
 * `GameRuntimeSaveStorage` port next without smuggling IndexedDB into game rules.
 */
export const connectGameRuntimeSavePersistence = ({
	debounceMs = 250,
	onError = defaultOnError,
	storage,
	store,
}: connectGameRuntimeSavePersistence.Props): connectGameRuntimeSavePersistence.Handle => {
	let disposed = false;
	let pendingSave: GameSave | undefined;
	let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
	let flushing: Promise<void> = Promise.resolve();

	const clearPendingTimeout = () => {
		if (timeout === undefined) return;
		globalThis.clearTimeout(timeout);
		timeout = undefined;
	};

	const scheduleRetryAfterFailure = () => {
		if (disposed || pendingSave === undefined || timeout !== undefined || debounceMs <= 0) {
			return;
		}

		timeout = globalThis.setTimeout(() => {
			void flush();
		}, debounceMs);
	};

	const persistPending = async () => {
		clearPendingTimeout();
		const save = pendingSave;
		pendingSave = undefined;
		if (!save) return;

		try {
			await storage.save(save);
		} catch (error) {
			if (pendingSave === undefined) {
				pendingSave = save;
			}
			onError(error);
			scheduleRetryAfterFailure();
		}
	};

	const flush = () => {
		flushing = flushing.then(persistPending);
		return flushing;
	};

	const flushBeforePageHide = () => {
		void flush();
	};
	const flushBeforeHidden = () => {
		if (document.visibilityState === "hidden") void flush();
	};
	const hasPageLifecycle =
		typeof window !== "undefined" &&
		typeof document !== "undefined" &&
		typeof window.addEventListener === "function" &&
		typeof document.addEventListener === "function";
	if (hasPageLifecycle) {
		window.addEventListener("pagehide", flushBeforePageHide);
		document.addEventListener("visibilitychange", flushBeforeHidden);
	}

	const schedule = (save: GameSave) => {
		if (disposed) return;
		pendingSave = save;
		clearPendingTimeout();

		if (debounceMs <= 0) {
			void flush();
			return;
		}

		timeout = globalThis.setTimeout(() => {
			void flush();
		}, debounceMs);
	};

	const unsubscribe = store.subscribeUpdate((update) => {
		schedule(update.current.runtime.save);
	});

	return {
		async destroy() {
			disposed = true;
			unsubscribe();
			if (hasPageLifecycle) {
				window.removeEventListener("pagehide", flushBeforePageHide);
				document.removeEventListener("visibilitychange", flushBeforeHidden);
			}
			await flush();
		},
		flush,
	};
};
