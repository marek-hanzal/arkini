import { Effect } from "effect";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";

const hashPattern = /^[a-f0-9]{64}$/;
const packagePattern = /^(?:arkini|[a-f0-9]{64})$/;

/** Validates one exact package/hash save identity before filesystem use. */
export const assertGameSaveKeyFx = Effect.fn("assertGameSaveKeyFx")(
	(key: ArkiniDesktopApi.SaveKey) =>
		packagePattern.test(key.packageId) && hashPattern.test(key.contentHash)
			? Effect.succeed(key)
			: Effect.fail(new Error("Invalid Arkini save identity.")),
);
