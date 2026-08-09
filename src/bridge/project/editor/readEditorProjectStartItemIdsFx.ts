import { Effect } from "effect";

import type { EditorProjectStartScope } from "~/bridge/project/editor/EditorProjectStartScope";
import { isItemLocationScopeAllowed } from "~/engine/location/read/isItemLocationScopeAllowedFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export namespace readEditorProjectStartItemIdsFx {
	export interface Props {
		readonly items: GameConfigSchema.Type["items"];
		readonly scope: EditorProjectStartScope;
	}
}

/** Reads canonical items that may own one editable initial grid scope. */
export const readEditorProjectStartItemIdsFx = Effect.fn("readEditorProjectStartItemIdsFx")(
	({ items, scope }: readEditorProjectStartItemIdsFx.Props) =>
		Effect.sync(
			() =>
				new Set(
					Object.values(items)
						.filter((item) =>
							isItemLocationScopeAllowed({
								item,
								locationScope: scope,
							}),
						)
						.map(({ id }) => id),
				),
		),
);
