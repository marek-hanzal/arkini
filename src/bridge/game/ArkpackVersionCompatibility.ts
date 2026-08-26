import { Effect } from "effect";

/** Reads the major/minor gameplay compatibility axis from a validated Arkpack version. */
export const readArkpackVersionFx = Effect.fn("readArkpackVersionFx")((version: string) =>
	Effect.sync(() => {
		const [major = "0", minor = "0"] = version.split(".");
		return {
			major: Number(major),
			minor: Number(minor),
		};
	}),
);
