export const runFeedback = async (feedback: (() => void | Promise<void>) | undefined) => {
	try {
		await feedback?.();
	} catch (error) {
		// Feedback must never turn a clean reject into another drag failure.
		void error;
	}
};
