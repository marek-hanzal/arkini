import { Layer, ManagedRuntime } from "effect";

/** One Effect root for the short-lived origin-flow Web Worker execution context. */
export const WorkerRuntime = ManagedRuntime.make(Layer.empty);
