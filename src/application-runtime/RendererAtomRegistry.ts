import { scheduleTask } from "@effect/atom-react";
import { Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

/**
 * One process-lifetime registry for every React-visible renderer Atom.
 * Arkini deliberately does not preserve application state across HMR.
 *
 * TODO(#397): Re-audit stable registry/runtime construction, scheduler integration,
 * retention semantics, and the measured need for the 400ms default idle TTL.
 */
export const RendererAtomRegistry = AtomRegistry.make({
	defaultIdleTTL: 400,
	scheduleTask,
});

/**
 * One process-lifetime zero-service Atom runtime for Effect-backed feature atoms.
 * Process-owned services remain in RendererRuntime.
 */
export const RendererAtomRuntime: Atom.AtomRuntime<never> = Atom.runtime(Layer.empty);
