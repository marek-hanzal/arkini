import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Reads the immutable persisted cheat state from one runtime snapshot. */
export const readCheatState = (runtime: RuntimeSchema.Type) => runtime.cheats;
