import type { playEventQueueMachine } from "./playEventQueueMachine";

export const activeQueuedEvent = (context: playEventQueueMachine.Context) => {
	if (!context.active)
		throw new Error("Event queue entered running state without an active event.");
	return context.active;
};
