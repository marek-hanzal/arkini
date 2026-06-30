import type { TileEngine } from "~/v0/tile-engine/TileEngine.types";

export namespace runTileDropCommit {
	export interface Props {
		motionId: string;
		animation: TileEngine.DropAnimation | undefined;
		commit: (() => Promise<unknown> | unknown) | undefined;
		immediate?: boolean;
	}
}

export const runTileDropCommit = async ({ commit }: runTileDropCommit.Props) => {
	try {
		await commit?.();
		return true;
	} catch {
		return false;
	}
};
