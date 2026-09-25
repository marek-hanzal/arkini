import { z } from "zod";

/** Selects graceful settlement or forced overflow discard at a terminal item event. */
export const TerminalModeSchema = z
	.enum([
		"loose-kill",
		"kill-switch",
	])
	.describe(
		"Loose-kill waits for accepted work and retries blocked expiry placement. Kill-switch cancels earlier work and discards terminal output or returned material that cannot be placed. A Board owner runs its selected terminal line as a Job; an internally held item settles its selected outcome immediately.",
	);
export type TerminalModeSchema = typeof TerminalModeSchema;
export namespace TerminalModeSchema {
	export type Type = z.infer<TerminalModeSchema>;
}
