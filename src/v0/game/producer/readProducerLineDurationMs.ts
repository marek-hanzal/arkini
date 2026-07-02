import type { GameProducerLineDefinition } from "~/v0/game/config/GameItemCapabilities";

export namespace readProducerLineDurationMs {
	export interface Props {
		line: GameProducerLineDefinition;
	}
}

export const readProducerLineDurationMs = ({ line }: readProducerLineDurationMs.Props) =>
	Math.max(0, line.durationMs);
