import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { AboutPortraitAssetsAtom } from "~/bridge/arkpack/AboutPortraitAssetsAtom";

/** Resolves optional About avatars from the effective default package resource owner. */
export const useAboutPortraitAssets = (): readonly string[] => {
	const result = useAtomValue(AboutPortraitAssetsAtom);
	return AsyncResult.isSuccess(result) ? result.value : [];
};
