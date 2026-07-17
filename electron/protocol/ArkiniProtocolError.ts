export class ArkiniProtocolError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = "ArkiniProtocolError";
		this.status = status;
	}
}
