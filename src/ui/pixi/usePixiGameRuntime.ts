import { useContext } from "react";

import { PixiGameRuntimeContext } from "~/ui/pixi/PixiGameRuntimeContext";

/** Reads route-local capabilities shared by otherwise independent Pixi scenes. */
export const usePixiGameRuntime = () => {
	const runtime = useContext(PixiGameRuntimeContext);
	if (runtime === undefined) {
		throw new Error("Pixi Game runtime is unavailable outside its provider.");
	}
	return runtime;
};
