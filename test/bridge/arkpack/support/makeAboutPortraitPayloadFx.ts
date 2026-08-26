import { Effect } from "effect";
import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";

export namespace makeAboutPortraitPayloadFx {
	export interface Props {
		readonly roles: Partial<
			Record<
				| "avatar-01"
				| "avatar-02"
				| "avatar-03"
				| "avatar-04"
				| "avatar-05"
				| "avatar-06"
				| "avatar-07",
				string
			>
		>;
	}
}

/** Builds a valid About portrait payload fixture with configurable avatar roles. */
export const makeAboutPortraitPayloadFx = Effect.fn("makeAboutPortraitPayloadFx")(
	({ roles }: makeAboutPortraitPayloadFx.Props) =>
		Effect.sync(
			(): PayloadSchema.Type => ({
				version: "1.0",
				arkini: ArkiniAppVersion,
				config: GameConfigSchema.parse({
					resources: {
						hero: "hero",
						...roles,
					},
					meta: {
						id: "game:avatars",
						title: "Avatars",
						board: {
							width: 1,
							height: 1,
						},
						inventory: {
							width: 1,
							height: 1,
						},
					},
					start: {
						currentSpace: 0,
					},
					items: {},
				}),
				resources: [
					"hero",
					"avatar:one",
					"avatar:two",
					"avatar:three",
					"avatar:four",
					"avatar:five",
					"avatar:six",
					"avatar:seven",
				].map((id) => ({
					id,
					mime: "image/png",
					bytes: new Uint8Array([
						1,
					]),
				})),
			}),
		),
);
