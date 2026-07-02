import type { GameProducerLineDefinition } from "~/v0/game/config/GameItemCapabilities";

export type ProducerLineKind = "effect" | "product";

export namespace readProducerLineKind {
	export interface Props {
		product: GameProducerLineDefinition;
	}
}

export const readProducerLineKind = ({ product }: readProducerLineKind.Props): ProducerLineKind =>
	product.activatesEffectId ? "effect" : "product";
