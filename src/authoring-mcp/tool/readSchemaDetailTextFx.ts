import { Effect } from "effect";
import { z } from "zod";

/** Reads one exact schema from Zod's process-wide registry for MCP authoring. */
export const readSchemaDetailTextFx = Effect.fn("readSchemaDetailTextFx")((id: string) =>
	Effect.try({
		try: () => {
			const schema = z.toJSONSchema(z.globalRegistry, {
				io: "input",
				reused: "inline",
				target: "draft-2020-12",
				unrepresentable: "any",
			}).schemas[id];
			if (schema === undefined)
				throw new Error(`Schema ${JSON.stringify(id)} is not registered.`);
			return JSON.stringify(schema, null, 2);
		},
		catch: (cause) => cause,
	}),
);
