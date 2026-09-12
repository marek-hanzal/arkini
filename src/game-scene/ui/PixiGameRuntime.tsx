import {
	createContext,
	type PropsWithChildren,
	useContext,
	useEffect,
	useMemo,
	useRef,
} from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import {
	createGameInteractionControlFx,
	type GameInteractionControl,
} from "~/tile-interaction/fx/createGameInteractionControlFx";
import { createTextureStoreFx, type TextureStore } from "~/tile-rendering/fx/createTextureStoreFx";

interface GameRuntimeCapabilities {
	readonly interaction: GameInteractionControl;
	readonly textures: TextureStore;
}

const PixiGameRuntimeContext = createContext<GameRuntimeCapabilities | undefined>(undefined);

/**
 * Owns route-local capabilities that must survive Board and Inventory scene alternation.
 *
 * Individual scene runtimes still own their canvases, actors, and subscriptions. The deferred
 * cleanup prevents a React development remount from disposing capabilities that the surviving
 * provider generation still uses.
 */
export const PixiGameProvider = ({ children }: PropsWithChildren) => {
	const interaction = useMemo(
		() => RendererRuntime.runSync(createGameInteractionControlFx()),
		[],
	);
	const textures = useMemo(() => RendererRuntime.runSync(createTextureStoreFx()), []);
	const capabilities = useMemo(
		() => ({
			interaction,
			textures,
		}),
		[
			interaction,
			textures,
		],
	);
	const effectGeneration = useRef(0);
	useEffect(() => {
		const generation = ++effectGeneration.current;
		return () => {
			queueMicrotask(() => {
				if (effectGeneration.current !== generation) return;
				RendererRuntime.runSync(interaction.closeFx);
				void RendererRuntime.runPromise(textures.closeFx).catch((cause) => {
					console.error("Pixi texture store failed to close.", cause);
				});
			});
		};
	}, [
		interaction,
		textures,
	]);
	return (
		<PixiGameRuntimeContext.Provider value={capabilities}>
			{children}
		</PixiGameRuntimeContext.Provider>
	);
};

/** Reads route-local capabilities shared by otherwise independent Pixi scenes. */
export const usePixiGameRuntime = () => {
	const runtime = useContext(PixiGameRuntimeContext);
	if (runtime === undefined) {
		throw new Error("Pixi Game runtime is unavailable outside its provider.");
	}
	return runtime;
};
