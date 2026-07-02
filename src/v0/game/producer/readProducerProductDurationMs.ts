import type { GameProducerLineDefinition } from "~/v0/game/config/GameItemCapabilities";

export namespace readProducerProductDurationMs {
	export interface Props {
		product: GameProducerLineDefinition;
	}
}

export const readProducerProductDurationMs = ({ product }: readProducerProductDurationMs.Props) =>
	Math.max(0, product.durationMs);
