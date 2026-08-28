import { Layer, ManagedRuntime } from "effect";

/** One Effect root for the short-lived editor-estimate Web Worker execution context. */
export const EditorItemEstimateWorkerRuntime = ManagedRuntime.make(Layer.empty);
