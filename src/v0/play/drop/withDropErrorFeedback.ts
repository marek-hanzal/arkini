import { toGameActionError } from "~/v0/play/action/toGameActionError";
import type { Feedback } from "~/v0/play/feedback/Feedback";

export namespace withDropErrorFeedback {
	export interface Props {
		feedback: Feedback.Type;
		commit(): Promise<unknown>;
	}
}

export const withDropErrorFeedback =
	({ feedback, commit }: withDropErrorFeedback.Props) =>
	async () => {
		try {
			await commit();
		} catch (error) {
			const actionError = toGameActionError(error);
			feedback.showError(actionError);
			throw actionError;
		}
	};
