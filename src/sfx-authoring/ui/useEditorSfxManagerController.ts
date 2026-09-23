import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
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
	Effect.map(
		Effect.all([
			ProjectRepository,
			ProjectWriteAdmission,
		]),
		([repository, admission]) =>
			Atom.fn((props: saveProjectConfigFx.Props) =>
				saveProjectConfigFx(props).pipe(
					Effect.provideService(ProjectRepository, repository),
					Effect.provideService(ProjectWriteAdmission, admission),
				),
			).pipe(Atom.withLabel("EditorSfxAssignment"), Atom.setIdleTTL(0)),
	),
);

export namespace useEditorSfxManagerController {
	export type View = "all" | "assigned" | "unused";

	export interface Output extends useEditorAudioResourceManagerController.Output {
		readonly resourceUidByEvent: SfxSchema.Type["events"];
		readonly assigningEvent?: SfxEventEnumSchema.Type;
		readonly assigningResourceUid?: string;
		readonly assignmentError?: unknown;
		readonly assignmentPending: boolean;
		readonly onOptimizeFn: () => void;
		readonly optimizationProgress?: ProjectRepository.OptimizeResourcesProgress;
		readonly optimizeError?: unknown;
		readonly optimizePending: boolean;
		readonly setViewFn: (view: View) => void;
		readonly sfx: ReadonlyArray<Project.Resource>;
		readonly assignResourceFn: (
			event: SfxEventEnumSchema.Type,
			resourceUid: string | undefined,
		) => void;
		readonly revealedResource?: {
			readonly id: string;
		};
		readonly revealResourceFn: (resourceUid: string) => void;
		readonly draggedResourceUid?: string;
		readonly setDraggedResourceUidFn: (resourceUid: string | undefined) => void;
		readonly allSfx: ReadonlyArray<Project.Resource>;
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
	const [assigningResourceUid, setAssigningResourceUidFn] = useState<string>();
	const [view, setViewFn] = useState<useEditorSfxManagerController.View>("all");
	const [revealedResource, setRevealedResourceFn] = useState<{
		readonly id: string;
	}>();
	const [draggedResourceUid, setDraggedResourceUidFn] = useState<string>();
	const allSfx = project.resources.filter(({ type }) => type === "sfx");
	const revealResourceFn = (resourceUid: string) => {
		setViewFn("all");
		audio.setQueryFn("");
		setRevealedResourceFn({
			id: resourceUid,
		});
	};
	const resourceUidByEvent = project.config.sfx?.events ?? {};
	const assignedResourceUids = useMemo(
		() => new Set(Object.values(resourceUidByEvent)),
		[
			resourceUidByEvent,
		],
	);
	const sfx = useMemo(
		() =>
			audio.resources.filter((resource) => {
				const assigned = assignedResourceUids.has(resource.uid);
				return view === "all" || (view === "assigned" ? assigned : !assigned);
			}),
		[
			assignedResourceUids,
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
	const assignResourceFn = (event: SfxEventEnumSchema.Type, resourceUid: string | undefined) => {
		if (assignmentPending || optimizePending || audio.importPending) return;
		if (resourceUid !== undefined && !allSfx.some(({ uid }) => uid === resourceUid)) return;
		if (resourceUidByEvent[event] === resourceUid) return;
		setAssigningEventFn(event);
		setAssigningResourceUidFn(resourceUid);
		const events = {
			...resourceUidByEvent,
		};
		if (resourceUid === undefined) delete events[event];
		else events[event] = resourceUid;
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
		if (optimizePending || audio.importPending || assignmentPending) return;
		const resourceUids = project.resources
			.filter(({ type }) => type === "sfx")
			.map(({ uid }) => uid);
		if (resourceUids.length === 0) return;
		optimizeResourcesFn({
			expectedRevision: project.revision,
			kind: "optimize",
			resourceUids,
			type: "sfx",
		});
	};

	return {
		activeResourceUid: audio.activeResourceUid,
		assigningEvent,
		assigningResourceUid,
		assignmentError,
		assignmentPending,
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
		resourceUidByEvent,
		resources: audio.resources,
		seekPlaybackFn: audio.seekPlaybackFn,
		setQueryFn: audio.setQueryFn,
		setVolumeFn: audio.setVolumeFn,
		setViewFn,
		sfx,
		assignResourceFn,
		allSfx,
		revealedResource,
		revealResourceFn,
		draggedResourceUid,
		setDraggedResourceUidFn,
		togglePlaybackFn: audio.togglePlaybackFn,
		totalResourceCount: audio.totalResourceCount,
		type: audio.type,
		view,
		volume: audio.volume,
	};
};
