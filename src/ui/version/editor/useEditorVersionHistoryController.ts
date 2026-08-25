import { useCallback, useEffect, useMemo, useState } from "react";

import { readEditorProjectVersionHistoryFx } from "~/bridge/editor/version/readEditorProjectVersionHistoryFx";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type {
	EditorProjectVersionDescriptor,
	EditorProjectVersionStatus,
} from "~/editor/version/EditorProjectVersion";
import {
	layoutEditorVersionGraph,
	type EditorVersionGraphLayout,
} from "~/ui/version/editor/layoutEditorVersionGraph";
import { useEditorVersionCheckout } from "~/ui/version/editor/useEditorVersionCheckout";
import { useEditorVersionComparison } from "~/ui/version/editor/useEditorVersionComparison";
import { useEditorVersionTag } from "~/ui/version/editor/useEditorVersionTag";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

interface HistoryState {
	readonly status: EditorProjectVersionStatus;
	readonly versions: ReadonlyArray<EditorProjectVersionDescriptor>;
}

export namespace useEditorVersionHistoryController {
	export interface Output {
		readonly cancelCheckout: () => void;
		readonly checkoutPending: boolean;
		readonly compareFrom: string;
		readonly compareTo: string;
		readonly confirmCheckout: () => void;
		readonly confirmVersion?: EditorProjectVersionDescriptor;
		readonly diff?: ReturnType<typeof useEditorVersionComparison>["diff"];
		readonly diffPending: boolean;
		readonly error?: string;
		readonly goToCommit: () => void;
		readonly graph?: EditorVersionGraphLayout;
		readonly history?: HistoryState;
		readonly projectId: string;
		readonly restoreSelected: () => void;
		readonly saveTag: () => void;
		readonly selectVersion: (versionId: string) => void;
		readonly selectWorkingCopy: () => void;
		readonly selected?: EditorProjectVersionDescriptor;
		readonly setCompareFrom: (value: string) => void;
		readonly setCompareTo: (value: string) => void;
		readonly setTagDraft: (value: string) => void;
		readonly tagDraft: string;
		readonly tagPending: boolean;
	}
}

/** Owns history loading and selection while focused child hooks own each mutation surface. */
export const useEditorVersionHistoryController = (): useEditorVersionHistoryController.Output => {
	const project = useEditorProject();
	const [error, setError] = useState<string>();
	const [history, setHistory] = useState<HistoryState>();
	const reportError = useCallback(
		(cause?: unknown) => setError(cause === undefined ? undefined : message(cause)),
		[],
	);
	const comparison = useEditorVersionComparison({
		enabled: history !== undefined,
		projectId: project.projectId,
		reportError,
	});
	const loadHistory = useCallback(() => {
		reportError();
		void RendererRuntime.runPromise(readEditorProjectVersionHistoryFx(project.projectId))
			.then((next) => {
				setHistory(next);
				comparison.resetToBase(next.status.currentBaseVersionId);
			})
			.catch(reportError);
	}, [
		comparison.resetToBase,
		project.projectId,
		reportError,
	]);

	useEffect(() => {
		loadHistory();
		return window.arkini.editor.onProjectChanged((projectId) => {
			if (projectId === project.projectId) loadHistory();
		});
	}, [
		loadHistory,
		project.projectId,
	]);
	const selected = history?.versions.find(
		(version) => version.versionId === comparison.compareTo,
	);
	const graph = useMemo(
		() =>
			history === undefined
				? undefined
				: layoutEditorVersionGraph(history.versions, history.status.currentBaseVersionId),
		[
			history,
		],
	);
	const checkout = useEditorVersionCheckout({
		project,
		projectDirty: history?.status.dirty === true,
		reportError,
		...(selected === undefined
			? {}
			: {
					selected,
				}),
	});
	const tag = useEditorVersionTag({
		reload: loadHistory,
		projectId: project.projectId,
		reportError,
		...(selected === undefined
			? {}
			: {
					selected,
				}),
	});
	const selectVersion = useCallback(
		(versionId: string) => {
			const version = history?.versions.find(
				(candidate) => candidate.versionId === versionId,
			);
			if (version === undefined) return;
			comparison.compareVersion(version);
		},
		[
			comparison.compareVersion,
			history,
		],
	);
	const selectWorkingCopy = useCallback(() => {
		comparison.resetToBase(history?.status.currentBaseVersionId);
	}, [
		comparison.resetToBase,
		history?.status.currentBaseVersionId,
	]);

	return {
		cancelCheckout: checkout.cancel,
		checkoutPending: checkout.pending,
		compareFrom: comparison.compareFrom,
		compareTo: comparison.compareTo,
		confirmCheckout: checkout.confirm,
		...(checkout.confirmVersion === undefined
			? {}
			: {
					confirmVersion: checkout.confirmVersion,
				}),
		...(comparison.diff === undefined
			? {}
			: {
					diff: comparison.diff,
				}),
		diffPending: comparison.pending,
		...(error === undefined
			? {}
			: {
					error,
				}),
		goToCommit: checkout.goToCommit,
		...(graph === undefined
			? {}
			: {
					graph,
				}),
		...(history === undefined
			? {}
			: {
					history,
				}),
		projectId: project.projectId,
		restoreSelected: checkout.restoreSelected,
		saveTag: tag.save,
		selectVersion,
		selectWorkingCopy,
		...(selected === undefined
			? {}
			: {
					selected,
				}),
		setCompareFrom: comparison.setCompareFrom,
		setCompareTo: comparison.setCompareTo,
		setTagDraft: tag.setDraft,
		tagDraft: tag.draft,
		tagPending: tag.pending,
	};
};
