import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import type { EditorProjectDescriptor } from "~/bridge/editor/EditorProjectDescriptor";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const placeholderHeroBytes = Uint8Array.from(
	atob(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
	),
	(character) => character.charCodeAt(0),
);

/** Creates one schema-valid empty project through the canonical editor repository. */
export const createFreshEditorProjectFx = Effect.fn("createFreshEditorProjectFx")(function* () {
	const projectId = yield* Effect.sync(() => IdSchema.parse(`project-${createId()}`));
	const config = GameConfigSchema.parse({
		meta: {
			id: projectId,
			title: "Untitled project",
			board: {
				width: 15,
				height: 9,
			},
			inventory: {
				width: 15,
				height: 9,
			},
			toolbarSize: 15,
		},
		resources: {
			hero: "hero",
		},
		start: {
			currentSpace: 0,
			board: [],
			inventory: [],
			toolbar: [],
		},
		items: {},
	});
	const repository = yield* EditorProjectRepository;
	const project = yield* repository.createProjectFx({
		projectId,
		version: "1.0",
		config,
		resources: [
			{
				id: "hero",
				mime: "image/png",
				bytes: placeholderHeroBytes.slice(),
			},
		],
	});
	return project satisfies EditorProjectDescriptor;
});
