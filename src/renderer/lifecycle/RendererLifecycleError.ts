import { Data } from "effect";

type RendererLifecycleOperation = "force-close" | "request-close" | "wait-until-visible";

export class RendererLifecycleError extends Data.TaggedError("RendererLifecycleError")<{
	readonly operation: RendererLifecycleOperation;
	readonly cause: unknown;
}> {
	override get message(): string {
		const causeMessage = this.cause instanceof Error ? this.cause.message : String(this.cause);
		return `Renderer lifecycle failed during ${this.operation}: ${causeMessage}`;
	}
}
