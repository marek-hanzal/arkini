import { DebugTimeline } from "~/v0/debug/DebugTimeline";
import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace runTileDropCommit {
	export interface Props {
		motionId: string;
		animation: TileEngine.DropAnimation | undefined;
		commit: (() => Promise<unknown> | unknown) | undefined;
		immediate?: boolean;
	}
}

export const runTileDropCommit = async ({
	motionId,
	animation,
	commit,
	immediate,
}: runTileDropCommit.Props) => {
	try {
		DebugTimeline.record({
			scope: "tile-engine",
			event: "drop.commit.start",
			detail: {
				motionId,
				animation,
				hasCommit: Boolean(commit),
				...(immediate
					? {
							immediate,
						}
					: {}),
			},
		});
		await commit?.();
		DebugTimeline.record({
			scope: "tile-engine",
			event: "drop.commit.ok",
			detail: {
				motionId,
				animation,
				...(immediate
					? {
							immediate,
						}
					: {}),
			},
		});
		return true;
	} catch {
		DebugTimeline.record({
			scope: "tile-engine",
			event: "drop.commit.error",
			detail: {
				motionId,
				animation,
				...(immediate
					? {
							immediate,
						}
					: {}),
			},
		});
		return false;
	}
};
