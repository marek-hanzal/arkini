import type { GameLineDefinition } from "~/v0/game/config/GameItemCapabilities";

export type LineKind = "effect" | "product";

export namespace readLineKind {
	export interface Props {
		line: GameLineDefinition;
	}
}

export const readLineKind = ({ line }: readLineKind.Props): LineKind =>
	line.activatesEffectId ? "effect" : "product";
