import type { SfxEventEnumSchema } from "~/sfx-event/schema/SfxEventEnumSchema";

/** One bounded request for the Game audio runtime to play an authored SFX assignment. */
export interface GameAudioCue {
	readonly event: SfxEventEnumSchema.Type;
	readonly strength: number;
}
