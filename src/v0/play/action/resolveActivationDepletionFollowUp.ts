import type { ActivationResultSchema } from "~/v0/activation/type/ActivationResultSchema";
import type { ActionVisualEventSchema } from "~/v0/play/action/ActionVisualEventSchema";
import { sequenceCompletionDelayMs } from "~/v0/play/visual-events/visualEventSequencing";

export const activationDepletionFollowUpBufferMs = 40;

export namespace resolveActivationDepletionFollowUp {
	export interface Props {
		activation?: ActivationResultSchema.Type;
		visualEvents: readonly ActionVisualEventSchema.Type[];
		bufferMs?: number;
	}

	export interface Result {
		boardItemId: string;
		delayMs: number;
	}
}

export const resolveActivationDepletionFollowUp = ({
	activation,
	bufferMs = activationDepletionFollowUpBufferMs,
	visualEvents,
}: resolveActivationDepletionFollowUp.Props): resolveActivationDepletionFollowUp.Result | null => {
	if (!activation?.depletion) return null;

	return {
		boardItemId: activation.activationBoardItemId,
		delayMs: sequenceCompletionDelayMs(visualEvents) + bufferMs,
	};
};
