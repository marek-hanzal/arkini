import type { GameLineDefinition } from "~/config/GameItemCapabilities";

export namespace readLineDurationMs {
	export interface Props {
		line: GameLineDefinition;
	}
}

export const readLineDurationMs = ({ line }: readLineDurationMs.Props) =>
	Math.max(0, line.durationMs);
