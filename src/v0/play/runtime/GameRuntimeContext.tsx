import {
	createContext,
	type FC,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type { GameRuntimeState } from "~/v0/play/runtime/GameRuntimeStore";
import { GameRuntimeStore } from "~/v0/play/runtime/GameRuntimeStore";
import { GameRuntimeVisualEffects } from "~/v0/play/runtime/GameRuntimeVisualEffects";

const GameRuntimeContext = createContext<GameRuntimeStore | null>(null);

export namespace GameRuntimeProvider {
	export interface Props {
		children: ReactNode;
		fallback?: ReactNode;
	}
}

const DefaultFallback: FC = () => (
	<div className="flex h-full min-h-[18rem] items-center justify-center rounded-md border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
		Starting runtime…
	</div>
);

export const GameRuntimeProvider: FC<GameRuntimeProvider.Props> = ({
	children,
	fallback = <DefaultFallback />,
}) => {
	const [store, setStore] = useState<GameRuntimeStore | null>(null);
	const storeRef = useRef<GameRuntimeStore | null>(null);

	useEffect(() => {
		let disposed = false;

		void GameRuntimeStore.create().then((nextStore) => {
			if (disposed) {
				nextStore.destroy();
				return;
			}

			storeRef.current = nextStore;
			setStore(nextStore);
		});

		return () => {
			disposed = true;
			storeRef.current?.destroy();
			storeRef.current = null;
		};
	}, []);

	if (!store) return <>{fallback}</>;

	return (
		<GameRuntimeContext.Provider value={store}>
			<GameRuntimeAutoTicker />
			<GameRuntimeVisualEffects store={store} />
			{children}
		</GameRuntimeContext.Provider>
	);
};

export const useGameRuntimeStore = () => {
	const store = useContext(GameRuntimeContext);
	if (!store) {
		throw new Error("GameRuntimeProvider is missing.");
	}

	return store;
};

export function useGameRuntimeSelector<T>(
	selector: (state: GameRuntimeState) => T,
	isEqual: (left: T, right: T) => boolean = Object.is,
): T {
	const store = useGameRuntimeStore();
	const lastRef = useRef<
		| {
				root: GameRuntimeState;
				selected: T;
			}
		| undefined
	>(undefined);

	const getSnapshot = useCallback(() => {
		const root = store.getSnapshot();
		const previous = lastRef.current;
		if (previous?.root === root) return previous.selected;

		const selected = selector(root);
		if (previous && isEqual(previous.selected, selected)) {
			lastRef.current = {
				root,
				selected: previous.selected,
			};
			return previous.selected;
		}

		lastRef.current = {
			root,
			selected,
		};
		return selected;
	}, [
		isEqual,
		selector,
		store,
	]);

	return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

const GameRuntimeAutoTicker: FC = () => {
	const store = useGameRuntimeStore();
	const nextWakeAtMs = useGameRuntimeSelector(
		(state) => state.runtime.nextWakeAtMs,
		Object.is,
	);

	useEffect(() => {
		if (nextWakeAtMs === null) return undefined;

		const timeout = globalThis.setTimeout(() => {
			void store.tick({
				nowMs: Date.now(),
			});
		}, Math.max(0, nextWakeAtMs - Date.now()));

		return () => globalThis.clearTimeout(timeout);
	}, [
		nextWakeAtMs,
		store,
	]);

	return null;
};
