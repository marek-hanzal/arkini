import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorAudioResourceManagerController } from "~/audio-authoring/ui/useEditorAudioResourceManagerController";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { SfxSchema } from "~/game-config/schema/SfxSchema";
import { saveProjectConfigFx } from "~/project-authoring/fx/saveProjectConfigFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

const assignEditorSfxAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.fn((props: saveProjectConfigFx.Props) =>
			saveProjectConfigFx(props).pipe(Effect.provideService(ProjectRepository, repository)),
		).pipe(Atom.withLabel("EditorSfxAssignment"), Atom.setIdleTTL(0)),
	),
);

export namespace useEditorSfxManagerController {
	export interface Output extends useEditorAudioResourceManagerController.Output {
		readonly resourceIdByEvent: SfxSchema.Type["events"];
		readonly assigningEvent?: GameEventEnumSchema.Type;
		readonly assigningResourceId?: string;
		readonly assignmentError?: unknown;
		readonly assignmentPending: boolean;
		readonly toggleAssignmentFn: (event: GameEventEnumSchema.Type, resourceId: string) => void;
	}
}

/** Adds one-resource-per-gameplay-event assignment to the shared SFX audio library. */
export const useEditorSfxManagerController = (): useEditorSfxManagerController.Output => {
	const project = useEditorProject();
	const audio = useEditorAudioResourceManagerController({
		type: "sfx",
	});
	const assignmentResult = useAtomValue(assignEditorSfxAtom);
	const assignSfxFn = useAtomSet(assignEditorSfxAtom);
	const [assigningEvent, setAssigningEventFn] = useState<GameEventEnumSchema.Type>();
	const [assigningResourceId, setAssigningResourceIdFn] = useState<string>();
	const resourceIdByEvent = project.config.sfx?.events ?? {};
	const assignmentPending = assignmentResult.waiting;
	const assignmentError = RendererRuntime.runSync(
		readSettledAsyncResultErrorFx(assignmentResult),
	);
	const toggleAssignmentFn = (event: GameEventEnumSchema.Type, resourceId: string) => {
		if (assignmentPending) return;
		setAssigningEventFn(event);
		setAssigningResourceIdFn(resourceId);
		const events = {
			...resourceIdByEvent,
		};
		if (events[event] === resourceId) delete events[event];
		else events[event] = resourceId;
		assignSfxFn({
			config: {
				...project.config,
				sfx: {
					events,
				},
			},
			expectedRevision: project.revision,
			projectId: project.projectId,
		});
	};

	return {
		activeResourceId: audio.activeResourceId,
		assigningEvent,
		assigningResourceId,
		assignmentError,
		assignmentPending,
		deleteError: audio.deleteError,
		deletePending: audio.deletePending,
		deleteResourceFn: audio.deleteResourceFn,
		deletingResourceId: audio.deletingResourceId,
		filesInputRef: audio.filesInputRef,
		importError: audio.importError,
		importPending: audio.importPending,
		onFilesChangeFn: audio.onFilesChangeFn,
		openFilesImportFn: audio.openFilesImportFn,
		playbackError: audio.playbackError,
		playbackProgress: audio.playbackProgress,
		playing: audio.playing,
		query: audio.query,
		resourceIdByEvent,
		resources: audio.resources,
		seekPlaybackFn: audio.seekPlaybackFn,
		setQueryFn: audio.setQueryFn,
		setVolumeFn: audio.setVolumeFn,
		toggleAssignmentFn,
		togglePlaybackFn: audio.togglePlaybackFn,
		totalResourceCount: audio.totalResourceCount,
		type: audio.type,
		volume: audio.volume,
	};
};
