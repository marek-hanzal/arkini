import { createContext, useContext } from "react";

export const boardMemoryOperationDurationMs = 950;

export interface BoardMemoryOperationState {
	boardItemId: string;
	startedAtMs: number;
	readyAtMs: number;
	type: "clear" | "restore" | "save";
}

const BoardMemoryOperationContext = createContext<BoardMemoryOperationState | undefined>(undefined);

export const BoardMemoryOperationProvider = BoardMemoryOperationContext.Provider;

export const useBoardMemoryOperation = () => useContext(BoardMemoryOperationContext);
