import type { GameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";
import type { BoardItemActivationContext } from "~/board/BoardItemActivationTypes";
import {
	dispatchBoardItemActivationRuntimeAction,
	tickRuntimeForReadyCraft,
} from "~/board/dispatchBoardItemActivationRuntimeAction";

export const handleClaimCraftTapAction = ({ context }: { context: BoardItemActivationContext }) => {
	tickRuntimeForReadyCraft({
		context,
	});
};

export const handleStartCraftTapAction = ({
	boardItemId,
	context,
	recipeId,
}: {
	boardItemId: string;
	context: BoardItemActivationContext;
	recipeId: string;
}) => {
	dispatchBoardItemActivationRuntimeAction({
		action: {
			recipeId,
			targetItemInstanceId: boardItemId,
			type: "craft.start",
		},
		context,
	});
};

export const handleBoardMemoryTapAction = ({
	boardItemId,
	context,
}: {
	boardItemId: string;
	context: BoardItemActivationContext;
}) => {
	dispatchBoardItemActivationRuntimeAction({
		action: {
			boardItemId,
			type: "board.memory.activate",
		},
		context,
	});
};

export const handleCheatSpeedTapAction = ({
	context,
	mode,
}: {
	context: BoardItemActivationContext;
	mode: GameCheatSpeedMode;
}) => {
	dispatchBoardItemActivationRuntimeAction({
		action: {
			mode,
			type: "cheat.speed_mode.set",
		},
		context,
	});
};
