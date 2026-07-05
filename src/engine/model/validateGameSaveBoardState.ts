import {
	addSaveIssue,
	type GameSaveValidationContext,
} from "~/engine/model/GameSaveConfigValidationContext";

const validateSaveBoardItems = ({ config, ctx, save }: GameSaveValidationContext) => {
	const usedBoardCells = new Map<string, string>();
	const boardItemCountByItemId = new Map<string, number>();

	for (const [itemInstanceId, boardItem] of Object.entries(save.board.items)) {
		if (boardItem.id !== itemInstanceId) {
			addSaveIssue(
				ctx,
				[
					"board",
					"items",
					itemInstanceId,
					"id",
				],
				`Board item id must match record key "${itemInstanceId}".`,
			);
		}

		boardItemCountByItemId.set(
			boardItem.itemId,
			(boardItemCountByItemId.get(boardItem.itemId) ?? 0) + 1,
		);

		const boardItemDefinition = config.items[boardItem.itemId];
		if (!boardItemDefinition) {
			addSaveIssue(
				ctx,
				[
					"board",
					"items",
					itemInstanceId,
					"itemId",
				],
				`Missing item "${boardItem.itemId}".`,
			);
		} else if (boardItemDefinition.storage === "inventory") {
			addSaveIssue(
				ctx,
				[
					"board",
					"items",
					itemInstanceId,
					"itemId",
				],
				`Item "${boardItem.itemId}" storage policy forbids board location.`,
			);
		}

		if (boardItem.x >= config.game.board.width) {
			addSaveIssue(
				ctx,
				[
					"board",
					"items",
					itemInstanceId,
					"x",
				],
				`x must be < board width (${config.game.board.width}).`,
			);
		}

		if (boardItem.y >= config.game.board.height) {
			addSaveIssue(
				ctx,
				[
					"board",
					"items",
					itemInstanceId,
					"y",
				],
				`y must be < board height (${config.game.board.height}).`,
			);
		}

		const cellKey = `${boardItem.x}:${boardItem.y}`;
		const firstItemInstanceId = usedBoardCells.get(cellKey);
		if (firstItemInstanceId) {
			addSaveIssue(
				ctx,
				[
					"board",
					"items",
					itemInstanceId,
				],
				`Duplicate board cell (${boardItem.x}, ${boardItem.y}). First used by "${firstItemInstanceId}".`,
			);
		} else {
			usedBoardCells.set(cellKey, itemInstanceId);
		}
	}

	return boardItemCountByItemId;
};

const validateSaveBoardItemMaxCounts = ({
	boardItemCountByItemId,
	config,
	ctx,
}: Pick<GameSaveValidationContext, "config" | "ctx"> & {
	boardItemCountByItemId: ReadonlyMap<string, number>;
}) => {
	for (const [itemId, quantity] of boardItemCountByItemId) {
		const maxCount = config.items[itemId]?.maxCount;
		if (maxCount === undefined || quantity <= maxCount) continue;

		addSaveIssue(
			ctx,
			[
				"board",
				"items",
			],
			`Board has ${quantity} item(s) of "${itemId}" but maxCount is ${maxCount}.`,
		);
	}
};

export const validateGameSaveBoardState = (validationContext: GameSaveValidationContext) => {
	const boardItemCountByItemId = validateSaveBoardItems(validationContext);
	validateSaveBoardItemMaxCounts({
		boardItemCountByItemId,
		config: validationContext.config,
		ctx: validationContext.ctx,
	});
};
