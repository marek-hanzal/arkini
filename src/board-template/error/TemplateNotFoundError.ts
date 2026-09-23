import { Data } from "effect";
import type { IdSchema } from "~/game-value/schema/IdSchema";

export class TemplateNotFoundError extends Data.TaggedError("TemplateNotFoundError")<{
	readonly templateUid: IdSchema.Type;
}> {}
