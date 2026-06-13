import { Effect } from "effect";
import type { GameConfig } from "~/manifest/data/GameConfig";
import { tryGameActionFx } from "./tryGameActionFx";

export namespace hashConfigFx {
	export interface Props {
		config: GameConfig;
	}
}

export const hashConfigFx = Effect.fn("hashConfigFx")(function* ({ config }: hashConfigFx.Props) {
	return yield* tryGameActionFx(async () => {
		const encoded = new TextEncoder().encode(
			JSON.stringify(config, (_key, value: unknown) => {
				if (typeof value === "string" && value.startsWith("blob:")) return "[blob-url]";
				return value;
			}),
		);
		const digest = await crypto.subtle.digest("SHA-256", encoded);

		return [
			...new Uint8Array(digest),
		]
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");
	});
});
