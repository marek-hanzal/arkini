import { Effect } from "effect";

const readErrorMessage = (error: unknown) => {
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
export const readEditorFieldErrorFx = Effect.fn("readEditorFieldErrorFx")(
	(errors: readonly unknown[]) =>
		Effect.sync(() => errors.map(readErrorMessage).find((message) => message !== undefined)),
);
