import { Effect } from "effect";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ElectronMainError } from "../ElectronMainError";

const packagePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Validates one stable package save identity before filesystem use. */
export const assertGameSaveKeyFx = Effect.fn("assertGameSaveKeyFx")(function* (
	key: ArkiniElectronApi.SaveKey,
) {
	if (packagePattern.test(key.packageId)) {
		return key;
	}
	return yield* Effect.fail(
		new ElectronMainError({
			operation: "Invalid Arkini save identity",
			cause: key,
		}),
	);
});
