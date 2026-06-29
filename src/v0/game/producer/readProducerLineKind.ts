import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export type ProducerLineKind = "effect" | "product";

export namespace readProducerLineKind {
	export interface Props {
		product: GameConfig["products"][string];
	}
}

export const readProducerLineKind = ({ product }: readProducerLineKind.Props): ProducerLineKind =>
	product.activatesEffectId ? "effect" : "product";
