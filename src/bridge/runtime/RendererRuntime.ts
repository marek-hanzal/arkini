import { Layer, ManagedRuntime } from "effect";

const makeRendererRuntime = () => ManagedRuntime.make(Layer.empty);

type RendererRuntime = ReturnType<typeof makeRendererRuntime>;

interface HotData {
	rendererRuntime?: RendererRuntime;
}

const hotData = (import.meta.hot?.data ?? {}) as HotData;

/** One process-lifetime Effect root for renderer bridge and shell programs. */
export const RendererRuntime = hotData.rendererRuntime ?? makeRendererRuntime();

if (import.meta.hot !== undefined) {
	hotData.rendererRuntime = RendererRuntime;
}
