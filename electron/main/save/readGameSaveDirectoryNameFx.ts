import { Effect } from "effect";

import { IdSchema } from "~/engine/common/schema/IdSchema";
import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ElectronMainError } from "../ElectronMainError";

/** Maps one canonical package identity to its collision-safe save directory name. */
export const readGameSaveDirectoryNameFx = Effect.fn("readGameSaveDirectoryNameFx")(function* (
	key: ArkiniElectronApi.SaveKey,
) {
	const parsed = IdSchema.safeParse(key.packageId);
	if (parsed.success) return encodeGameProjectFileStem(parsed.data);
	return yield* Effect.fail(
		new ElectronMainError({
			operation: "Invalid Arkini save identity",
			cause: key,
		}),
	);
});
