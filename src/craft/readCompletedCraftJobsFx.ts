import { Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { readWorldCraftJobFacts } from "~/world/readWorldCraftJobFacts";

export namespace readCompletedCraftJobsFx {
	export interface Props {
		save: GameSave;
		nowMs: number;
	}
}

export const readCompletedCraftJobsFx = Effect.fn("readCompletedCraftJobsFx")(function* ({
	save,
	nowMs,
}: readCompletedCraftJobsFx.Props) {
	return readWorldCraftJobFacts({
		nowMs,
		save,
	})
		.filter((facts) => facts.releaseAtMs !== undefined && facts.releaseAtMs <= nowMs)
		.map((facts) => facts.job);
});
