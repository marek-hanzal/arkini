import { type PropsWithChildren, useEffect, useMemo, useRef } from "react";

import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { PixiGameRuntimeContext } from "~/ui/pixi/PixiGameRuntimeContext";
import { createTileSceneHandoffStoreFx } from "~/ui/pixi/handoff/createTileSceneHandoffStoreFx";
import { createPixiGameInteractionControlFx } from "~/ui/pixi/runtime/createPixiGameInteractionControlFx";
import { createPixiTextureStoreFx } from "~/ui/pixi/runtime/createPixiTextureStoreFx";

/**
 * Owns route-local capabilities that must survive Board and Inventory scene alternation.
 *
 * Individual scene runtimes still own their canvases, actors, and subscriptions. The deferred
 * cleanup prevents a React development remount from disposing capabilities that the surviving
 * provider generation still uses.
 */
export const PixiGameProvider = ({ children }: PropsWithChildren) => {
	const handoffs = useMemo(() => RendererRuntime.runSync(createTileSceneHandoffStoreFx()), []);
	const interaction = useMemo(
		() => RendererRuntime.runSync(createPixiGameInteractionControlFx()),
		[],
	);
	const textures = useMemo(() => RendererRuntime.runSync(createPixiTextureStoreFx()), []);
	const capabilities = useMemo(
		() => ({
			handoffs,
			interaction,
			textures,
		}),
		[
			handoffs,
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
				RendererRuntime.runSync(handoffs.closeFx);
				RendererRuntime.runSync(interaction.closeFx);
				void RendererRuntime.runPromise(textures.closeFx).catch((cause) => {
					console.error("Pixi texture store failed to close.", cause);
				});
			});
		};
	}, [
		handoffs,
		interaction,
		textures,
	]);
	return (
		<PixiGameRuntimeContext.Provider value={capabilities}>
			{children}
		</PixiGameRuntimeContext.Provider>
	);
};
