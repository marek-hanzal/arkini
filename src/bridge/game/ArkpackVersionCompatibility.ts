import { Effect } from "effect";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

/** Reads the sole gameplay admission axis from a validated Arkpack version. */
export const readArkpackVersionFx = Effect.fn("readArkpackVersionFx")((version: string) =>
	Effect.sync(() => {
		const parsed = ArkpackVersionSchema.parse(version);
		return {
			major: parsed.slice(0, parsed.indexOf(".")),
		};
	}),
);
