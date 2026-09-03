import { Effect } from "effect";
import { z } from "zod";

/** Decodes one serialized MCP authoring input through its canonical Zod schema. */
export const parseToolInputJsonFx = <Schema extends z.ZodType>(
	input: string,
	schema: Schema,
): Effect.Effect<z.output<Schema>, unknown, never> =>
	Effect.try({
		try: () => schema.parse(JSON.parse(input)),
		catch: (cause) => cause,
	});
