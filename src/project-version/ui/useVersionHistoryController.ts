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

const messageFn = (error: unknown) => (error instanceof Error ? error.message : String(error));

interface HistoryState {
	readonly status: ProjectVersionStatus;
	readonly versions: ReadonlyArray<ProjectVersionDescriptor>;
}

export namespace useVersionHistoryController {
	export interface Output {
		readonly cancelCheckoutFn: () => void;
		readonly checkoutPending: boolean;
		readonly compareFrom: string;
		readonly compareTo: string;
		readonly confirmCheckoutFn: () => void;
		readonly confirmVersion?: ProjectVersionDescriptor;
		readonly diff?: ProjectVersionDiff;
		readonly diffPending: boolean;
		readonly error?: string;
		readonly goToCommitFn: () => void;
		readonly graph?: VersionGraphLayout;
		readonly history?: HistoryState;
		readonly projectId: string;
		readonly restoreVersionFn: (versionId: string) => void;
		readonly saveTagFn: () => void;
		readonly selectVersionFn: (versionId: string) => void;
		readonly selectWorkingCopyFn: () => void;
		readonly selected?: ProjectVersionDescriptor;
		readonly setCompareFromFn: (value: string) => void;
		readonly setCompareToFn: (value: string) => void;
		readonly setTagDraftFn: (value: string) => void;
		readonly tagDraft: string;
		readonly tagPending: boolean;
	}
}

/** Owns history loading and selection while focused child hooks own each mutation surface. */
export const useVersionHistoryController = (): useVersionHistoryController.Output => {
	const project = useEditorProject();
	const [error, setErrorFn] = useState<string>();
	const [history, setHistoryFn] = useState<HistoryState>();
	const reportErrorFn = useCallback(
		(cause?: unknown) => setErrorFn(cause === undefined ? undefined : messageFn(cause)),
		[],
	);
	const comparison = useVersionComparison({
		enabled: history !== undefined,
		projectId: project.projectId,
		reportErrorFn,
	});
	const loadHistoryFn = useCallback(() => {
		reportErrorFn();
		void RendererRuntime.runPromise(readProjectVersionHistoryFx(project.projectId))
			.then((next) => {
				setHistoryFn(next);
				comparison.resetToBaseFn(next.status.currentBaseVersionId);
			})
			.catch(reportErrorFn);
	}, [
		comparison.resetToBaseFn,
		project.projectId,
		reportErrorFn,
	]);

	useEffect(() => {
		loadHistoryFn();
		return window.arkini.editor.onProjectChangedFn((projectId) => {
			if (projectId === project.projectId) loadHistoryFn();
		});
	}, [
		loadHistoryFn,
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
		reportErrorFn,
	});
	const tag = useVersionTag({
		reloadFn: loadHistoryFn,
		projectId: project.projectId,
		reportErrorFn,
		...(selected === undefined
			? {}
			: {
					selected,
				}),
	});
	const selectVersionFn = (versionId: string) => {
		const version = history?.versions.find((candidate) => candidate.versionId === versionId);
		if (version === undefined) return;
		comparison.compareVersionFn(version);
	};
	const selectWorkingCopyFn = () => {
		comparison.resetToBaseFn(history?.status.currentBaseVersionId);
	};
	const restoreVersionFn = (versionId: string) => {
		const version = history?.versions.find((candidate) => candidate.versionId === versionId);
		if (version !== undefined) checkout.restoreVersionFn(version);
	};

	return {
		cancelCheckoutFn: checkout.cancelFn,
		checkoutPending: checkout.pending,
		compareFrom: comparison.compareFrom,
		compareTo: comparison.compareTo,
		confirmCheckoutFn: checkout.confirmFn,
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
		goToCommitFn: checkout.goToCommitFn,
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
		restoreVersionFn,
		saveTagFn: tag.saveFn,
		selectVersionFn,
		selectWorkingCopyFn,
		...(selected === undefined
			? {}
			: {
					selected,
				}),
		setCompareFromFn: comparison.setCompareFromFn,
		setCompareToFn: comparison.setCompareToFn,
		setTagDraftFn: tag.setDraftFn,
		tagDraft: tag.draft,
		tagPending: tag.pending,
	};
};
