import { Effect } from "effect";

import { EditorSourceFileSchema } from "~/engine/editor/schema/EditorSourceFileSchema";
import { GameSourceSchema } from "~/engine/schema/GameSourceSchema";

export namespace createEditorJsonSourceFileFx {
	export interface Props {
		readonly path: string;
		readonly value: GameSourceSchema.Type;
	}
}

/** Serializes one canonical game-source fragment into stable human-editable JSON bytes. */
export const createEditorJsonSourceFileFx = Effect.fn("createEditorJsonSourceFileFx")(
	({ path, value }: createEditorJsonSourceFileFx.Props) =>
		Effect.sync(() =>
			EditorSourceFileSchema.parse({
				path,
				bytes: new TextEncoder().encode(
					`${JSON.stringify(GameSourceSchema.parse(value), null, "\t")}\n`,
				),
			}),
		),
);
