import type { ActionResult } from "~/v0/play/action/ActionResult";
import { DebugTimeline } from "~/v0/debug/DebugTimeline";

export namespace recordActionMutation {
	export type Phase =
		| "mutate.start"
		| "mutate.success"
		| "mutate.error"
		| "cache.optimistic.start"
		| "cache.restore"
		| "side-effect.start"
		| "side-effect.success"
		| "side-effect.error";

	export interface Props {
		action: string;
		phase: Phase;
		detail?: unknown;
	}
}

const summarizeResult = (result: ActionResult.Type) => ({
	visualEvents: result.visualEvents.map((event) => event.type),
});

const summarizeError = (error: unknown) =>
	error instanceof Error
		? {
				name: error.name,
				message: error.message,
				stack: error.stack,
			}
		: error;

export const recordActionMutation = ({ action, detail, phase }: recordActionMutation.Props) => {
	DebugTimeline.record({
		scope: "action",
		event: `${action}.${phase}`,
		detail:
			phase === "mutate.success" && detail && typeof detail === "object"
				? summarizeResult(detail as ActionResult.Type)
				: phase === "mutate.error"
					? summarizeError(detail)
					: detail,
	});
};
