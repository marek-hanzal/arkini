import ArkiniGamePackUrl from "../../../game/arkini.game.arkpack?url";

/** Stable launcher identity and bundled binary URL for the default Arkini package. */
export const BuiltinArkpack = {
	packageId: "builtin-arkini",
	url: ArkiniGamePackUrl,
} as const;
