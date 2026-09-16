import { z } from "zod";

/** Persisted percentage volume for one application sound bus. */
export const SoundVolumeSchema = z.number().int().min(0).max(100);

export type SoundVolumeSchema = typeof SoundVolumeSchema;

export namespace SoundVolumeSchema {
	export type Type = z.infer<SoundVolumeSchema>;
}
