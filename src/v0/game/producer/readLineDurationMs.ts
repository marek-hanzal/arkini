import type { GameLineDefinition } from "~/v0/game/config/GameItemCapabilities";

export namespace readLineDurationMs {
	export interface Props {
		line: GameLineDefinition;
	}
}

export const readLineDurationMs = ({ line }: readLineDurationMs.Props) =>
	Math.max(0, line.durationMs);
