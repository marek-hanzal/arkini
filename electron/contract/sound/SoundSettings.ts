import type { SoundVolumeSchema } from "./SoundVolumeSchema";
import { z } from "zod";

export interface SoundSettings {
	readonly master: SoundVolumeSchema.Type;
	readonly music: SoundVolumeSchema.Type;
	readonly sfx: SoundVolumeSchema.Type;
}

export const defaultSoundSettings = {
	master: 100,
	music: 10,
	sfx: 5,
} satisfies SoundSettings;

export const SoundChannelSchema = z.enum([
	"master",
	"music",
	"sfx",
]);

export type SoundChannel = z.infer<typeof SoundChannelSchema>;
