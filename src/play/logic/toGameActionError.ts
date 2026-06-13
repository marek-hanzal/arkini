import { GameActionError } from "~/play/logic/playTypes";

export function toGameActionError(error: unknown) {
	if (error instanceof GameActionError) return error;
	if (error instanceof Error) return new GameActionError(error.message);
	return new GameActionError("Game action failed.");
}
