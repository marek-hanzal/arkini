import { open } from "node:fs/promises";
import { Effect } from "effect";

import { admitSerakkiVersionFx } from "~/application-version/fx/admitSerakkiVersionFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { SerapackFileLayout } from "~/serapack-artifact/type/SerapackFileLayout";

/** Reads and admits only the JSON configuration range of one laid-out Serapack. */
export const readSerapackFileConfigFx = Effect.fn("readSerapackFileConfigFx")(function* (
	layout: SerapackFileLayout,
) {
	const config = yield* Effect.tryPromise({
		try: async () => {
			const file = await open(layout.serapackPath, "r");
			try {
				const bytes = Buffer.allocUnsafe(layout.configLength);
				const { bytesRead } = await file.read(
					bytes,
					0,
					layout.configLength,
					layout.configOffset,
				);
				if (bytesRead !== layout.configLength)
					throw new Error("Invalid pack: truncated config.");
				return GameConfigSchema.parse(
					JSON.parse(
						new TextDecoder("utf-8", {
							fatal: true,
						}).decode(bytes),
					),
				);
			} finally {
				await file.close();
			}
		},
		catch: (cause) => cause,
	});
	yield* admitSerakkiVersionFx("Serapack", layout.manifest.serakki);
	return config;
});
