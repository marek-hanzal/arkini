import { Data } from "effect";

export class DesktopPackagingError extends Data.TaggedError("DesktopPackagingError")<{
	readonly operation: string;
	readonly cause: unknown;
}> {
	override get message(): string {
		return `Desktop packaging operation failed: ${this.operation}`;
	}
}
