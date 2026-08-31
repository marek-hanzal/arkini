import { useCallback, useEffect, useMemo, useState } from "react";

import { readProjectVersionHistoryFx } from "~/project-version/fx/readProjectVersionHistoryFx";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type {
	ProjectVersionDescriptor,
	ProjectVersionDiff,
	ProjectVersionStatus,
} from "~/project-version/type/ProjectVersion";
import {
	layoutVersionGraphFn,
	type VersionGraphLayout,
} from "~/project-version/fn/layoutVersionGraphFn";
import { useVersionCheckout } from "~/project-version/ui/useVersionCheckout";
import { useVersionComparison } from "~/project-version/ui/useVersionComparison";
import { useVersionTag } from "~/project-version/ui/useVersionTag";

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

interface HistoryState {
	readonly status: ProjectVersionStatus;
	readonly versions: ReadonlyArray<ProjectVersionDescriptor>;
}

export namespace useVersionHistoryController {
	export interface Output {
		readonly cancelCheckout: () => void;
		readonly checkoutPending: boolean;
		readonly compareFrom: string;
		readonly compareTo: string;
		readonly confirmCheckout: () => void;
		readonly confirmVersion?: ProjectVersionDescriptor;
		readonly diff?: ProjectVersionDiff;
		readonly diffPending: boolean;
		readonly error?: string;
		readonly goToCommit: () => void;
		readonly graph?: VersionGraphLayout;
		readonly history?: HistoryState;
		readonly projectId: string;
		readonly restoreSelected: () => void;
		readonly saveTag: () => void;
		readonly selectVersion: (versionId: string) => void;
		readonly selectWorkingCopy: () => void;
		readonly selected?: ProjectVersionDescriptor;
		readonly setCompareFrom: (value: string) => void;
		readonly setCompareTo: (value: string) => void;
		readonly setTagDraft: (value: string) => void;
		readonly tagDraft: string;
		readonly tagPending: boolean;
	}
}

/** Owns history loading and selection while focused child hooks own each mutation surface. */
export const useVersionHistoryController = (): useVersionHistoryController.Output => {
	const project = useEditorProject();
	const [error, setError] = useState<string>();
	const [history, setHistory] = useState<HistoryState>();
	const reportError = useCallback(
		(cause?: unknown) => setError(cause === undefined ? undefined : message(cause)),
		[],
	);
	const comparison = useVersionComparison({
		enabled: history !== undefined,
		projectId: project.projectId,
		reportError,
	});
	const loadHistory = useCallback(() => {
		reportError();
		void RendererRuntime.runPromise(readProjectVersionHistoryFx(project.projectId))
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
				: layoutVersionGraphFn(history.versions, history.status.currentBaseVersionId),
		[
			history,
		],
	);
	const checkout = useVersionCheckout({
		project,
		projectDirty: history?.status.dirty === true,
		reportError,
		...(selected === undefined
			? {}
			: {
					selected,
				}),
	});
	const tag = useVersionTag({
		reload: loadHistory,
		projectId: project.projectId,
		reportError,
		...(selected === undefined
			? {}
			: {
					selected,
				}),
	});
	const selectVersion = (versionId: string) => {
		const version = history?.versions.find((candidate) => candidate.versionId === versionId);
		if (version === undefined) return;
		comparison.compareVersion(version);
	};
	const selectWorkingCopy = () => {
		comparison.resetToBase(history?.status.currentBaseVersionId);
	};

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
