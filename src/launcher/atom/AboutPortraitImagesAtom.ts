import { createAboutPortraitImagesFx } from "~/launcher/fx/createAboutPortraitImagesFx";
import { RendererAtomRuntime } from "~/application-runtime/atom/RendererAtomRegistry";

/** Scoped renderer owner of the canonical Arkini About portrait object URLs. */
export const AboutPortraitImagesAtom = RendererAtomRuntime.atom(createAboutPortraitImagesFx());
