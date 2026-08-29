import { createAboutPortraitAssetsFx } from "~/ui/launcher/about/createAboutPortraitAssetsFx";
import { RendererAtomRuntime } from "~/application-runtime/RendererAtomRegistry";

/** Scoped renderer owner of the canonical Arkini About portrait object URLs. */
export const AboutPortraitAssetsAtom = RendererAtomRuntime.atom(createAboutPortraitAssetsFx());
