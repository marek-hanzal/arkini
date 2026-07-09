import type { GameCheatSpeedMode } from "~/cheat/GameCheatSpeedMode";
import type { BoardItemActivationRuntime } from "~/board/BoardItemActivationTypes";
import {
	dispatchBoardItemActivationRuntimeAction,
	tickRuntimeForReadyCraft,
} from "~/board/dispatchBoardItemActivationRuntimeAction";

export const handleClaimCraftTapAction = ({
	feedback,
	nowMs,
	runtimeStore,
}: BoardItemActivationRuntime & {
	nowMs: number;
}) => {
	tickRuntimeForReadyCraft({
		feedback,
		nowMs,
		runtimeStore,
	});
};

export const handleStartCraftTapAction = ({
	boardItemId,
	feedback,
	nowMs,
	recipeId,
	runtimeStore,
}: BoardItemActivationRuntime & {
	boardItemId: string;
	nowMs: number;
	recipeId: string;
}) => {
	dispatchBoardItemActivationRuntimeAction({
		action: {
			recipeId,
			targetItemInstanceId: boardItemId,
			type: "craft.start",
		},
		feedback,
		nowMs,
		runtimeStore,
	});
};

export const handleBoardMemoryTapAction = ({
	boardItemId,
	feedback,
	nowMs,
	runtimeStore,
}: BoardItemActivationRuntime & {
	boardItemId: string;
	nowMs: number;
}) => {
	dispatchBoardItemActivationRuntimeAction({
		action: {
			boardItemId,
			type: "board.memory.activate",
		},
		feedback,
		nowMs,
		runtimeStore,
	});
};

export const handleCheatSpeedTapAction = ({
	feedback,
	mode,
	nowMs,
	runtimeStore,
}: BoardItemActivationRuntime & {
	mode: GameCheatSpeedMode;
	nowMs: number;
}) => {
	dispatchBoardItemActivationRuntimeAction({
		action: {
			mode,
			type: "cheat.speed_mode.set",
		},
		feedback,
		nowMs,
		runtimeStore,
	});
};
