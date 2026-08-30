import { createAboutPortraitAssetsFx } from "~/launcher/fx/createAboutPortraitAssetsFx";
import { RendererAtomRuntime } from "~/application-runtime/atom/RendererAtomRegistry";

/** Scoped renderer owner of the canonical Arkini About portrait object URLs. */
export const AboutPortraitAssetsAtom = RendererAtomRuntime.atom(createAboutPortraitAssetsFx());
