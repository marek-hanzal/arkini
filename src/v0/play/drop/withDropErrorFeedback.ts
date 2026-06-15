import type { Feedback } from "~/v0/play/Feedback";

export namespace withDropErrorFeedback {
	export interface Props {
		feedback: Feedback;
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
