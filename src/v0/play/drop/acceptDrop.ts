import type { TileEngineNamespace as TileEngine } from "~/v0/tile-engine";

export namespace acceptDrop {
	export interface Options {
		animation?: TileEngine.DropAnimation;
	}
}

export const acceptDrop = (
	commit: () => Promise<unknown>,
	options: acceptDrop.Options = {},
): TileEngine.DropOutcome => ({
	type: "accept",
	animation: options.animation,
	commit,
});
