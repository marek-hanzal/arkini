export class GameActionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GameActionError";
	}
}
