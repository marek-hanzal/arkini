import { createContext } from "react";

import type { PresentationSfxEventEnumSchema } from "~/sfx-event/schema/PresentationSfxEventEnumSchema";

export interface GameAudioControl {
	readonly requestDetailMusicFn: (resourceUid: string | undefined) => void;
	readonly playSfxEventFn: (event: PresentationSfxEventEnumSchema.Type) => void;
}

export const GameAudioContext = createContext<GameAudioControl | undefined>(undefined);
