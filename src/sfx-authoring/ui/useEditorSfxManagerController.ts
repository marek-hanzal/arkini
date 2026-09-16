import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo, useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { EditorResourceOptimizationAtom } from "~/resource-authoring/atom/EditorResourceOptimizationAtom";
import { useEditorAudioResourceManagerController } from "~/audio-authoring/ui/useEditorAudioResourceManagerController";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import type { SfxSchema } from "~/game-config/schema/SfxSchema";
import { saveProjectConfigFx } from "~/project-authoring/fx/saveProjectConfigFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import type { Project } from "~/project-authoring/type/Project";
import type { SfxEventEnumSchema } from "~/sfx-event/schema/SfxEventEnumSchema";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";

const assignEditorSfxAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.fn((props: saveProjectConfigFx.Props) =>
			saveProjectConfigFx(props).pipe(Effect.provideService(ProjectRepository, repository)),
		).pipe(Atom.withLabel("EditorSfxAssignment"), Atom.setIdleTTL(0)),
	),
);

export namespace useEditorSfxManagerController {
	export type View = "all" | "assigned" | "unused";

	export interface Output extends useEditorAudioResourceManagerController.Output {
		readonly resourceIdByEvent: SfxSchema.Type["events"];
		readonly assigningEvent?: SfxEventEnumSchema.Type;
		readonly assigningResourceId?: string;
		readonly assignmentError?: unknown;
		readonly assignmentPending: boolean;
		readonly onOptimizeFn: () => void;
		readonly optimizationProgress?: ProjectRepository.OptimizeResourcesProgress;
		readonly optimizeError?: unknown;
		readonly optimizePending: boolean;
		readonly setViewFn: (view: View) => void;
		readonly sfx: ReadonlyArray<Project.Resource>;
		readonly toggleAssignmentFn: (event: SfxEventEnumSchema.Type, resourceId: string) => void;
		readonly view: View;
	}
}

/** Adds one-resource-per-Game-interaction assignment to the shared SFX audio library. */
export const useEditorSfxManagerController = (): useEditorSfxManagerController.Output => {
	const project = useEditorProject();
	const audio = useEditorAudioResourceManagerController({
		type: "sfx",
	});
	const assignmentResult = useAtomValue(assignEditorSfxAtom);
	const assignSfxFn = useAtomSet(assignEditorSfxAtom);
	const optimizationAtom = EditorResourceOptimizationAtom(project.projectId);
	const optimizationState = useAtomValue(optimizationAtom);
	const optimizeResourcesFn = useAtomSet(optimizationAtom);
	const [assigningEvent, setAssigningEventFn] = useState<SfxEventEnumSchema.Type>();
	const [assigningResourceId, setAssigningResourceIdFn] = useState<string>();
	const [view, setViewFn] = useState<useEditorSfxManagerController.View>("all");
	const resourceIdByEvent = project.config.sfx?.events ?? {};
	const assignedResourceIds = useMemo(
		() => new Set(Object.values(resourceIdByEvent)),
		[
			resourceIdByEvent,
		],
	);
	const sfx = useMemo(
		() =>
			audio.resources.filter((resource) => {
				const assigned = assignedResourceIds.has(resource.id);
				return view === "all" || (view === "assigned" ? assigned : !assigned);
			}),
		[
			assignedResourceIds,
			audio.resources,
			view,
		],
	);
	const assignmentPending = assignmentResult.waiting;
	const assignmentError = RendererRuntime.runSync(
		readSettledAsyncResultErrorFx(assignmentResult),
	);
	const optimizePending = optimizationState.kind === "optimizing";
	const optimizeError =
		optimizationState.kind === "failure" && optimizationState.type === "sfx"
			? optimizationState.error
			: undefined;
	const optimizationProgress =
		optimizationState.kind === "optimizing" && optimizationState.type === "sfx"
			? optimizationState.progress
			: undefined;
	const toggleAssignmentFn = (event: SfxEventEnumSchema.Type, resourceId: string) => {
		if (assignmentPending || optimizePending) return;
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
	const onOptimizeFn = () => {
		if (optimizePending || audio.importPending || audio.deletePending || assignmentPending)
			return;
		const resourceIds = project.resources
			.filter(({ type }) => type === "sfx")
			.map(({ id }) => id);
		if (resourceIds.length === 0) return;
		optimizeResourcesFn({
			expectedRevision: project.revision,
			kind: "optimize",
			resourceIds,
			type: "sfx",
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
		onOptimizeFn,
		openFilesImportFn: audio.openFilesImportFn,
		optimizationProgress,
		optimizeError,
		optimizePending,
		playbackError: audio.playbackError,
		playbackProgress: audio.playbackProgress,
		playing: audio.playing,
		query: audio.query,
		resourceIdByEvent,
		resources: audio.resources,
		seekPlaybackFn: audio.seekPlaybackFn,
		setQueryFn: audio.setQueryFn,
		setVolumeFn: audio.setVolumeFn,
		setViewFn,
		sfx,
		toggleAssignmentFn,
		togglePlaybackFn: audio.togglePlaybackFn,
		totalResourceCount: audio.totalResourceCount,
		type: audio.type,
		view,
		volume: audio.volume,
	};
};
