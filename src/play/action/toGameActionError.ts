import { GameActionError } from "~/play/action/GameActionError";

const messageFromErrorLike = (error: unknown) => {
	if (typeof error === "string") return error;
	if (error instanceof Error) return error.message;
	if (error && typeof error === "object" && "message" in error) {
		const message = (
			error as {
				message?: unknown;
			}
		).message;
		if (typeof message === "string" && message.length > 0) return message;
	}

	return undefined;
};

export function toGameActionError(error: unknown) {
	if (error instanceof GameActionError) return error;
	return new GameActionError(messageFromErrorLike(error) ?? "Game action failed.");
}
