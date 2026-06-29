import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export namespace readProducerProductDurationMs {
	export interface Props {
		product: GameConfig["products"][string];
	}
}

export const readProducerProductDurationMs = ({ product }: readProducerProductDurationMs.Props) =>
	Math.max(0, product.durationMs);
