const readErrorMessageFn = (error: unknown) => {
	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}
	return typeof error === "string" ? error : undefined;
};

/** Reads the first user-facing message published for one registered form field. */
export const readEditorFieldErrorFn = (errors: readonly unknown[]) =>
	errors.map(readErrorMessageFn).find((message) => message !== undefined);
