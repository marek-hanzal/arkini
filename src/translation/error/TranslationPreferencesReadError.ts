import { Data } from "effect";

export class TranslationPreferencesReadError extends Data.TaggedError(
	"TranslationPreferencesReadError",
)<{
	readonly cause: unknown;
}> {
	override get message(): string {
		const causeMessage = this.cause instanceof Error ? this.cause.message : String(this.cause);
		return `Reading preferred translation languages failed: ${causeMessage}`;
	}
}
