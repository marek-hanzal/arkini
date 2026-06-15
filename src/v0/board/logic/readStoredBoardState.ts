import { createInitialBoardState } from "./createInitialBoardState";
import { parseJson } from "~/v0/serialization/parseJson";

export const readStoredBoardState = (stateJson: string) =>
	parseJson<ReturnType<typeof createInitialBoardState>>(stateJson || "{}");
