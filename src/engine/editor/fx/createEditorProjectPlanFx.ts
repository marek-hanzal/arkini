import { Effect } from "effect";

import { assertEditorSourceFilePathsFx } from "~/engine/editor/fx/assertEditorSourceFilePathsFx";
import { createEditorProjectIdFx } from "~/engine/editor/fx/createEditorProjectIdFx";
import { EditorProjectPlanSchema } from "~/engine/editor/schema/EditorProjectPlanSchema";
import { createGameEditorSourceFileFx } from "~/engine/game/editor/fx/createGameEditorSourceFileFx";
import { createItemEditorSourceFilesFx } from "~/engine/item/editor/fx/createItemEditorSourceFilesFx";
import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";
import { createResourceEditorSourceFilesFx } from "~/engine/resource/editor/fx/createResourceEditorSourceFilesFx";

export namespace createEditorProjectPlanFx {
	export interface Props {
		readonly contentHash: string;
		readonly payload: PayloadSchema.Type;
	}
}

/** Expands one validated arkpack payload into a deterministic atomic editor workspace plan. */
export const createEditorProjectPlanFx = Effect.fn("createEditorProjectPlanFx")(function* ({
	contentHash,
	payload,
}: createEditorProjectPlanFx.Props) {
	const projectId = yield* createEditorProjectIdFx({
		gameId: payload.config.meta.id,
		contentHash,
	});
	const files = [
		yield* createGameEditorSourceFileFx(payload.config),
		...(yield* createItemEditorSourceFilesFx(payload.config.items)),
		...(yield* createResourceEditorSourceFilesFx(payload.resources, payload.config.resources)),
	].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
	yield* assertEditorSourceFilePathsFx(files);
	return EditorProjectPlanSchema.parse({
		projectId,
		title: payload.config.meta.title,
		version: payload.config.version,
		files,
	});
});
