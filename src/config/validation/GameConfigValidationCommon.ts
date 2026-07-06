import { z } from "zod";
import type { GameConfig } from "~/config/GameConfigTypes";

export type GameConfigIssuePath = (string | number)[];

export type GameConfigValidationContext = {
	config: GameConfig;
	ctx: z.RefinementCtx;
	grantIds: readonly string[];
	hasAsset: (assetId: string) => boolean;
	hasItem: (itemId: string) => boolean;
	hasResource: (resourceId: string) => boolean;
	itemIds: readonly string[];
};

export const createRecordGuard = (record: Readonly<Record<string, unknown>>) => (key: string) =>
	Object.hasOwn(record, key);

export const addIssue = (ctx: z.RefinementCtx, path: GameConfigIssuePath, message: string) => {
	ctx.addIssue({
		code: "custom",
		path,
		message,
	});
};

export const validateUniqueStringList = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	values: readonly string[],
	createMessage: (value: string) => string,
) => {
	const firstIndexByValue = new Map<string, number>();

	for (const [index, value] of values.entries()) {
		const firstIndex = firstIndexByValue.get(value);
		if (firstIndex !== undefined) {
			addIssue(
				ctx,
				[
					...path,
					index,
				],
				createMessage(value),
			);
			continue;
		}

		firstIndexByValue.set(value, index);
	}
};

export const validateItemInputs = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	inputs: readonly {
		capacity: number;
		itemId: string;
		quantity: number;
	}[],
	hasItem: (itemId: string) => boolean,
) => {
	validateUniqueStringList(
		ctx,
		path,
		inputs.map((input) => input.itemId),
		(value) => `Duplicate input item "${value}".`,
	);

	for (const [index, input] of inputs.entries()) {
		if (!hasItem(input.itemId)) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"itemId",
				],
				`Missing item "${input.itemId}".`,
			);
		}

		if (input.capacity < input.quantity) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"capacity",
				],
				`Capacity must be >= quantity (${input.quantity}).`,
			);
		}
	}
};

export const validateCraftRecipeInputs = (
	ctx: z.RefinementCtx,
	path: GameConfigIssuePath,
	inputs: readonly {
		consume: boolean;
		itemId: string;
	}[],
	hasItem: (itemId: string) => boolean,
) => {
	validateUniqueStringList(
		ctx,
		path,
		inputs.map((input) => input.itemId),
		(value) => `Duplicate craft input item "${value}".`,
	);

	for (const [index, input] of inputs.entries()) {
		if (!hasItem(input.itemId)) {
			addIssue(
				ctx,
				[
					...path,
					index,
					"itemId",
				],
				`Missing item "${input.itemId}".`,
			);
		}
	}
};
