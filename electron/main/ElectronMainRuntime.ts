import { NodeContext } from "@effect/platform-node";
import { ManagedRuntime } from "effect";

/** One process-lifetime Effect root for Electron main programs and callbacks. */
export const ElectronMainRuntime = ManagedRuntime.make(NodeContext.layer);
