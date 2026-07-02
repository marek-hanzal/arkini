export type GameItemQuantityIndex = Readonly<Record<string, number | undefined>>;

export const emptyGameItemQuantityIndex: GameItemQuantityIndex = Object.freeze({});

export const readGameItemQuantity = ({
	itemId,
	quantities,
}: {
	itemId: string;
	quantities: GameItemQuantityIndex;
}) => quantities[itemId] ?? 0;
