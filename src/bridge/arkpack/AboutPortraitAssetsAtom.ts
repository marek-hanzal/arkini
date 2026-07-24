import { createAboutPortraitAssetsFx } from "~/bridge/arkpack/createAboutPortraitAssetsFx";
import { RendererAtomRuntime } from "~/bridge/reactivity/RendererAtomRegistry";

/** Scoped renderer owner of the canonical Arkini About portrait object URLs. */
export const AboutPortraitAssetsAtom = RendererAtomRuntime.atom(createAboutPortraitAssetsFx());
