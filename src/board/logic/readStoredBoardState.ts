import { createInitialBoardState } from "./createInitialBoardState";
import { parseJson } from "~/shared/parseJson";

export const readStoredBoardState = (stateJson: string) =>
	parseJson<ReturnType<typeof createInitialBoardState>>(stateJson || "{}");
