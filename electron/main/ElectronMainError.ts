import { Data } from "effect";

export class ElectronMainError extends Data.TaggedError("ElectronMainError")<{
	readonly operation: string;
	readonly cause: unknown;
}> {
	override get message(): string {
		return `Electron main operation failed: ${this.operation}`;
	}
}
