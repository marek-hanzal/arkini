import { Effect } from "effect";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { publishEditorProjectFx } from "~/bridge/editor/publishEditorProjectFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

export namespace saveEditorProjectConfigFx {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly expectedRevision: number;
		readonly projectId: string;
	}
}

/** Atomically replaces one complete canonical project config and publishes its revision. */
export const saveEditorProjectConfigFx = Effect.fn("saveEditorProjectConfigFx")(function* ({
	config: candidate,
	expectedRevision,
	projectId,
}: saveEditorProjectConfigFx.Props) {
	const config = yield* Effect.try({
		try: () => GameConfigSchema.parse(candidate),
		catch: (cause) =>
			new EditorProjectError({
				reason: "invalid-config",
				message: "The project configuration is invalid.",
				cause,
			}),
	});
	const repository = yield* EditorProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const commit = yield* repository.replaceConfigFx({
				config,
				expectedRevision,
				projectId,
			});
			yield* publishEditorProjectFx(projectId, {
				commit,
			});
			return config;
		}),
	);
});
