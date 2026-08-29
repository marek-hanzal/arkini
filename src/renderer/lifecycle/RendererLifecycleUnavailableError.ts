import { Data } from "effect";

/** Signals that renderer lifecycle composition did not run before a consumer started. */
export class RendererLifecycleUnavailableError extends Data.TaggedError(
	"RendererLifecycleUnavailableError",
)<{}> {
	override get message(): string {
		return "Arkini Electron lifecycle is unavailable.";
	}
}
