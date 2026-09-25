import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";

export namespace readItemTerminalStateFn {
	export interface Result {
		readonly cause: "expired" | "depleted";
		readonly mode: "loose-kill" | "kill-switch";
	}
}

/** One terminal decision for the exact live identity; depletion wins a tied boundary. */
export const readItemTerminalStateFn = (
	item: RuntimeItemSchema.Type,
	cause?: readItemTerminalStateFn.Result["cause"],
): readItemTerminalStateFn.Result | undefined => {
	if (cause !== "expired" && item.item.units !== undefined && item.remainingUnits === 0)
		return {
			cause: "depleted",
			mode: item.item.terminationMode ?? "loose-kill",
		};
	if (cause !== "depleted" && item.schedule?.remainingDurationMs === 0)
		return {
			cause: "expired",
			mode: item.item.terminationMode ?? "loose-kill",
		};
	return undefined;
};
