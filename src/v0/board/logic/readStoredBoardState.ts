import { createInitialBoardState } from "./createInitialBoardState";
import { parseJson } from "~/v0/style/parseJson";

export const readStoredBoardState = (stateJson: string) =>
	parseJson<ReturnType<typeof createInitialBoardState>>(stateJson || "{}");
