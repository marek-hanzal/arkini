export namespace runTileDropCommit {
	export interface Props {
		commit: (() => Promise<unknown> | unknown) | undefined;
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
