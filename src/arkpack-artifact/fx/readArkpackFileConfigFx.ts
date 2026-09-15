import { open } from "node:fs/promises";
import { Effect } from "effect";

import { admitArkiniVersionFx } from "~/application-version/fx/admitArkiniVersionFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ArkpackFileLayout } from "~/arkpack-artifact/type/ArkpackFileLayout";

/** Reads and admits only the JSON configuration range of one laid-out Arkpack. */
export const readArkpackFileConfigFx = Effect.fn("readArkpackFileConfigFx")(function* (
	layout: ArkpackFileLayout,
) {
	const config = yield* Effect.tryPromise({
		try: async () => {
			const file = await open(layout.arkpackPath, "r");
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
	yield* admitArkiniVersionFx("Arkpack", layout.manifest.arkini);
	return config;
});
