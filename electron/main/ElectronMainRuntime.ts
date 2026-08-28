import * as NodeServices from "@effect/platform-node/NodeServices";
import { ManagedRuntime } from "effect";

/**
 * One process-lifetime Effect root for Electron main programs and callbacks.
 *
 * TODO(#397): Revalidate stable ManagedRuntime and platform-node Layer construction;
 * Electron callbacks must keep sharing this single process-owned runtime.
 */
export const ElectronMainRuntime = ManagedRuntime.make(NodeServices.layer);
