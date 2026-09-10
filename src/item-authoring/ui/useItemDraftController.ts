import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { saveDraftStatusFx } from "~/item-authoring/fx/saveDraftStatusFx";
import { readDraftFn } from "~/item-authoring/fn/readDraftFn";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

const saveDraftStatusCommandAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: Omit<saveDraftStatusFx.Props, "projectId">) =>
				saveDraftStatusFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(ProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

export namespace useItemDraftController {
	export interface Props {
		readonly item: ItemSchema.Type;
	}

	export interface Output {
		readonly error: unknown;
		readonly pending: boolean;
		readonly toggleFn: () => Promise<void>;
	}
}

/** Owns one revision-pinned item draft-status write and its settled failure. */
export const useItemDraftController = ({
	item,
}: useItemDraftController.Props): useItemDraftController.Output => {
	const project = useEditorProject();
	const commandAtom = saveDraftStatusCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const saveFn = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const toggleFn = useCallback(async () => {
		if (result.waiting) return;
		try {
			await saveFn({
				config: project.config,
				draft: !readDraftFn(item),
				expectedRevision: project.revision,
				itemId: item.id,
			});
		} catch {
			// The settled command error remains visible beside the action.
		}
	}, [
		item,
		project.config,
		project.revision,
		result.waiting,
		saveFn,
	]);
	return {
		error: RendererRuntime.runSync(readSettledAsyncResultErrorFx(result)),
		pending: result.waiting,
		toggleFn,
	};
};
