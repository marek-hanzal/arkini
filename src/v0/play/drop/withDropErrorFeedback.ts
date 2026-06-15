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
			feedback.showError(error);
			throw error;
		}
	};
