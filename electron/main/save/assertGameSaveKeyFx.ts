import { Effect } from "effect";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ElectronMainError } from "../ElectronMainError";

const hashPattern = /^[a-f0-9]{64}$/;
const packagePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Validates one exact package/hash save identity before filesystem use. */
export const assertGameSaveKeyFx = Effect.fn("assertGameSaveKeyFx")(function* (
	key: ArkiniElectronApi.SaveKey,
) {
	if (packagePattern.test(key.packageId) && hashPattern.test(key.contentHash)) {
		return key;
	}
	return yield* Effect.fail(
		new ElectronMainError({
			operation: "Invalid Arkini save identity",
			cause: key,
		}),
	);
});
