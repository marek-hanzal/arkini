import { pastDueWorldJobWakeDelayMs } from "~/world/pastDueWorldJobWakeDelayMs";

export const readProcessableWorldWakeAtMs = ({
	nowMs,
	readyAtMs,
}: {
	nowMs?: number;
	readyAtMs: number;
}) => (nowMs !== undefined && readyAtMs <= nowMs ? nowMs + pastDueWorldJobWakeDelayMs : readyAtMs);
