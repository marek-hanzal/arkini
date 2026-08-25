import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { checkoutEditorProjectVersionFx } from "~/bridge/editor/version/checkoutEditorProjectVersionFx";
import { readEditorProjectVersionDiffFx } from "~/bridge/editor/version/readEditorProjectVersionDiffFx";
import { readEditorProjectVersionHistoryFx } from "~/bridge/editor/version/readEditorProjectVersionHistoryFx";
import { updateEditorProjectVersionTagFx } from "~/bridge/editor/version/updateEditorProjectVersionTagFx";
import { useEditorProject } from "~/bridge/editor/useEditorProject";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type {
	EditorProjectVersionDescriptor,
	EditorProjectVersionDiff,
	EditorProjectVersionReference,
	EditorProjectVersionStatus,
} from "~/editor/version/EditorProjectVersion";
import { useEditorUnsavedChangesOwner } from "~/ui/editor/useEditorUnsavedChangesRegistration";
import {
	layoutEditorVersionGraph,
	type EditorVersionGraphLayout,
} from "~/ui/version/editor/layoutEditorVersionGraph";

const currentReference: EditorProjectVersionReference = {
	type: "current",
};
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

const decodeReference = (value: string): EditorProjectVersionReference =>
	value === "current"
		? currentReference
		: {
				type: "version",
				versionId: value,
			};

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
		readonly diff?: EditorProjectVersionDiff;
		readonly diffPending: boolean;
		readonly error?: string;
		readonly goToCommit: () => void;
		readonly graph?: EditorVersionGraphLayout;
		readonly history?: HistoryState;
		readonly projectId: string;
		readonly restoreSelected: () => void;
		readonly saveTag: () => void;
		readonly selectVersion: (versionId: string) => void;
		readonly selected?: EditorProjectVersionDescriptor;
		readonly setCompareFrom: (value: string) => void;
		readonly setCompareTo: (value: string) => void;
		readonly setTagDraft: (value: string) => void;
		readonly tagDraft: string;
		readonly tagPending: boolean;
	}
}

export const useEditorVersionHistoryController = (): useEditorVersionHistoryController.Output => {
	const project = useEditorProject();
	const router = useRouter();
	const unsavedOwner = useEditorUnsavedChangesOwner();
	const unsaved = useSyncExternalStore(
		unsavedOwner.subscribe,
		unsavedOwner.getSnapshot,
		unsavedOwner.getSnapshot,
	);
	const [checkoutPending, setCheckoutPending] = useState(false);
	const [compareFrom, setCompareFrom] = useState("current");
	const [compareTo, setCompareTo] = useState("current");
	const [confirmVersionId, setConfirmVersionId] = useState<string>();
	const [diff, setDiff] = useState<EditorProjectVersionDiff>();
	const [diffPending, setDiffPending] = useState(false);
	const [error, setError] = useState<string>();
	const [history, setHistory] = useState<HistoryState>();
	const [selectedVersionId, setSelectedVersionId] = useState<string>();
	const [tagDraft, setTagDraft] = useState("");
	const [tagPending, setTagPending] = useState(false);

	const loadHistory = useCallback(() => {
		setError(undefined);
		void RendererRuntime.runPromise(readEditorProjectVersionHistoryFx(project.projectId))
			.then((next) => {
				setHistory(next);
				const selectedId = next.status.currentBaseVersionId ?? next.versions[0]?.versionId;
				setSelectedVersionId((current) => current ?? selectedId);
				if (next.status.currentBaseVersionId !== undefined) {
					setCompareFrom(next.status.currentBaseVersionId);
					setCompareTo("current");
				}
			})
			.catch((cause) => setError(message(cause)));
	}, [
		project.projectId,
	]);

	useEffect(loadHistory, [
		loadHistory,
	]);
	const selected = history?.versions.find((version) => version.versionId === selectedVersionId);
	const confirmVersion = history?.versions.find(
		(version) => version.versionId === confirmVersionId,
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

	useEffect(
		() => setTagDraft(selected?.tag ?? ""),
		[
			selected,
		],
	);
	useEffect(() => {
		if (history === undefined) return;
		let mounted = true;
		setDiffPending(true);
		void RendererRuntime.runPromise(
			readEditorProjectVersionDiffFx({
				projectId: project.projectId,
				from: decodeReference(compareFrom),
				to: decodeReference(compareTo),
			}),
		)
			.then((next) => {
				if (!mounted) return;
				setDiff(next);
				setDiffPending(false);
			})
			.catch((cause) => {
				if (!mounted) return;
				setError(message(cause));
				setDiff(undefined);
				setDiffPending(false);
			});
		return () => {
			mounted = false;
		};
	}, [
		compareFrom,
		compareTo,
		history,
		project.projectId,
	]);

	const selectVersion = useCallback(
		(versionId: string) => {
			const version = history?.versions.find(
				(candidate) => candidate.versionId === versionId,
			);
			if (version === undefined) return;
			setSelectedVersionId(versionId);
			setCompareFrom(version.parentVersionId ?? version.versionId);
			setCompareTo(version.versionId);
		},
		[
			history,
		],
	);
	const runCheckout = useCallback(
		(versionId: string) => {
			if (checkoutPending) return;
			setCheckoutPending(true);
			setError(undefined);
			void RendererRuntime.runPromise(
				checkoutEditorProjectVersionFx({
					currentProject: project,
					versionId,
				}),
			)
				.then(async () => {
					await router.navigate({
						to: "/editor/$projectId/versions/history",
						params: {
							projectId: project.projectId,
						},
						replace: true,
					});
					await router.invalidate();
				})
				.catch((cause) => {
					setError(message(cause));
					setCheckoutPending(false);
					setConfirmVersionId(undefined);
				});
		},
		[
			checkoutPending,
			project,
			router,
		],
	);
	const restoreSelected = useCallback(() => {
		if (selected === undefined || selected.applicability.type === "incompatible") return;
		if (history?.status.dirty === true || unsaved.hasDirtySession) {
			setConfirmVersionId(selected.versionId);
			return;
		}
		runCheckout(selected.versionId);
	}, [
		history?.status.dirty,
		runCheckout,
		selected,
		unsaved.hasDirtySession,
	]);
	const confirmCheckout = useCallback(() => {
		if (confirmVersion !== undefined) runCheckout(confirmVersion.versionId);
	}, [
		confirmVersion,
		runCheckout,
	]);
	const goToCommit = useCallback(() => {
		setConfirmVersionId(undefined);
		void router.navigate({
			to: "/editor/$projectId/versions/commit",
			params: {
				projectId: project.projectId,
			},
			search: {
				returnTo: `/editor/${project.projectId}/versions/history`,
			},
		});
	}, [
		project.projectId,
		router,
	]);
	const saveTag = useCallback(() => {
		if (selected === undefined || selected.applicability.type === "incompatible" || tagPending)
			return;
		setTagPending(true);
		setError(undefined);
		void RendererRuntime.runPromise(
			updateEditorProjectVersionTagFx({
				projectId: project.projectId,
				...(tagDraft.trim() === ""
					? {}
					: {
							tag: tagDraft,
						}),
				versionId: selected.versionId,
			}),
		)
			.then(() => {
				setTagPending(false);
				loadHistory();
			})
			.catch((cause) => {
				setError(message(cause));
				setTagPending(false);
			});
	}, [
		loadHistory,
		project.projectId,
		selected,
		tagDraft,
		tagPending,
	]);

	return useMemo(
		() => ({
			cancelCheckout: () => setConfirmVersionId(undefined),
			checkoutPending,
			compareFrom,
			compareTo,
			confirmCheckout,
			...(confirmVersion === undefined
				? {}
				: {
						confirmVersion,
					}),
			...(diff === undefined
				? {}
				: {
						diff,
					}),
			diffPending,
			...(error === undefined
				? {}
				: {
						error,
					}),
			goToCommit,
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
			restoreSelected,
			saveTag,
			selectVersion,
			...(selected === undefined
				? {}
				: {
						selected,
					}),
			setCompareFrom,
			setCompareTo,
			setTagDraft,
			tagDraft,
			tagPending,
		}),
		[
			checkoutPending,
			compareFrom,
			compareTo,
			confirmCheckout,
			confirmVersion,
			diff,
			diffPending,
			error,
			goToCommit,
			graph,
			history,
			project.projectId,
			restoreSelected,
			saveTag,
			selectVersion,
			selected,
			tagDraft,
			tagPending,
		],
	);
};
