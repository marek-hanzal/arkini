import type { GameConfig } from "~/v0/game/config/GameConfigSchema";

export namespace doesGameEffectTargetProductLine {
	export interface Props {
		producerId: string;
		producerTags: readonly string[];
		product: GameConfig["products"][string];
		productId: string;
		target: GameConfig["effects"][string]["operations"][number]["target"];
	}
}

const hasAny = (source: ReadonlySet<string>, values: readonly string[] | undefined) =>
	!values || values.length === 0 || values.some((value) => source.has(value));

const hasAll = (source: ReadonlySet<string>, values: readonly string[] | undefined) =>
	!values || values.length === 0 || values.every((value) => source.has(value));

const includesId = (values: readonly string[] | undefined, value: string) =>
	!values || values.length === 0 || values.includes(value);

export const doesGameEffectTargetProductLine = ({
	producerId,
	producerTags,
	product,
	productId,
	target,
}: doesGameEffectTargetProductLine.Props) => {
	const producerTagSet = new Set(producerTags);
	const productTagSet = new Set(product.tags);

	return (
		includesId(target.producerIds, producerId) &&
		includesId(target.productIds, productId) &&
		hasAny(producerTagSet, target.producerTagsAny) &&
		hasAll(producerTagSet, target.producerTagsAll) &&
		hasAny(productTagSet, target.productTagsAny) &&
		hasAll(productTagSet, target.productTagsAll)
	);
};
