import { readResourceNameFn } from "~/game-config-resource/fn/readResourceNameFn";

/** Names newly created metadata; existing sidecars remain strict and never use this fallback. */
export const readInitialAudioResourceNameFn = (resourceId: string) =>
	readResourceNameFn(resourceId).trim() || resourceId.trim() || "Audio";
