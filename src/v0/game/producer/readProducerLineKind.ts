import type { GameProducerLineDefinition } from "~/v0/game/config/GameItemCapabilities";

export type ProducerLineKind = "effect" | "product";

export namespace readProducerLineKind {
	export interface Props {
		line: GameProducerLineDefinition;
	}
}

export const readProducerLineKind = ({ line }: readProducerLineKind.Props): ProducerLineKind =>
	line.activatesEffectId ? "effect" : "product";
