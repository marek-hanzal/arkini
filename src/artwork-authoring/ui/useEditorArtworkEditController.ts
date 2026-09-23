import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import type { ArtworkCatalogFilterSchema } from "~/artwork-authoring/schema/ArtworkCatalogFilterSchema";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { editEditorArtworkFx } from "~/artwork-authoring/fx/editEditorArtworkFx";
import { validateEditorArtworkFileFx } from "~/artwork-authoring/fx/validateEditorArtworkFileFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ResourceMetadataSchema } from "~/game-config-resource/schema/ResourceMetadataSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorArtworkByUid } from "~/artwork-authoring/ui/useEditorArtworkByUid";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";

interface EditEditorArtworkCommandProps {
	readonly title: string;
	readonly file?: File;
	readonly resourceUid: string;
}

const validateEditorArtworkDraftFx = Effect.fn("validateEditorArtworkDraftFx")(function* ({
	file,
	resourceUid,
	title,
}: {
	readonly file?: File;
	readonly resourceUid: string;
	readonly title: string;
}) {
	yield* Effect.try({
		try: () =>
			ResourceMetadataSchema.parse({
				title,
			}),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-resource-title",
				message: "Artwork title must not be empty.",
				cause,
			}),
	});
	if (file !== undefined) yield* validateEditorArtworkFileFx(file, resourceUid);
});

const editEditorArtworkCommandAtom = RendererRuntime.runSync(
	Effect.map(
		Effect.all([
			ProjectRepository,
			ProjectWriteAdmission,
		]),
		([repository, admission]) =>
			Atom.family((projectId: string) =>
				Atom.fn((props: EditEditorArtworkCommandProps) =>
					editEditorArtworkFx({
						...props,
						projectId,
					}).pipe(
						Effect.provideService(ProjectRepository, repository),
						Effect.provideService(ProjectWriteAdmission, admission),
					),
				).pipe(Atom.setIdleTTL(0)),
			),
	),
);

export namespace useEditorArtworkEditController {
	export interface Props {
		readonly filter: ArtworkCatalogFilterSchema.Type;
		readonly query: string;
		readonly resourceUid: string;
	}

	export interface Output {
		readonly titleError?: string;
		readonly currentUrl?: string;
		readonly dirty: boolean;
		readonly discardFn: () => Promise<void>;
		readonly error: unknown;
		readonly file?: File;
		readonly fileError?: string;
		readonly title: string;
		readonly projectId: string;
		readonly resourceFound: boolean;
		readonly saveFn: () => Promise<boolean>;
		readonly saving: boolean;
		readonly setFileFn: (file: File | undefined) => void;
		readonly setTitleFn: (resourceUid: string) => void;
	}
}

export const useEditorArtworkEditController = ({
	filter,
	query,
	resourceUid,
}: useEditorArtworkEditController.Props): useEditorArtworkEditController.Output => {
	const project = useEditorProject();
	const admission = RendererRuntime.runSync(ProjectWriteAdmission);
	const resource = useEditorArtworkByUid(resourceUid);
	const currentUrl = useResourceUrl(resourceUid);
	const navigateFn = useNavigate();
	const commandAtom = editEditorArtworkCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const mutateFn = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const [title, setTitleStateFn] = useState(resource?.title ?? "");
	const [file, setFileStateFn] = useState<File>();
	const [saving, setSavingFn] = useState(false);
	const mountedRef = useRef(false);
	const draftEpochRef = useRef(0);
	const pendingSaveRef = useRef<number | undefined>(undefined);
	const commandEpochRef = useRef<number | undefined>(undefined);
	const canonicalTitleRef = useRef(resource?.title ?? "");
	useLayoutEffect(() => {
		const previousTitle = canonicalTitleRef.current;
		canonicalTitleRef.current = resource?.title ?? "";
		if (pendingSaveRef.current === undefined && file === undefined && title === previousTitle) {
			setTitleStateFn(canonicalTitleRef.current);
		}
	}, [
		resource?.title,
		title,
		file,
	]);
	useLayoutEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			draftEpochRef.current += 1;
			pendingSaveRef.current = undefined;
		};
	}, [
		project.projectId,
		resourceUid,
	]);
	const invalidateSaveFn = useCallback(() => {
		draftEpochRef.current += 1;
		pendingSaveRef.current = undefined;
		setSavingFn(false);
	}, []);
	const [validationIssue, setValidationIssueFn] = useState<{
		readonly field: "title" | "file";
		readonly message: string;
	}>();
	const setTitleFn = useCallback(
		(value: string) => {
			if (pendingSaveRef.current !== undefined || result.waiting) return;
			invalidateSaveFn();
			setTitleStateFn(value);
			setValidationIssueFn((current) => (current?.field === "title" ? undefined : current));
		},
		[
			invalidateSaveFn,
			result.waiting,
		],
	);
	const setFileFn = useCallback(
		(value: File | undefined) => {
			if (pendingSaveRef.current !== undefined || result.waiting) return;
			invalidateSaveFn();
			setFileStateFn(value);
			setValidationIssueFn((current) => (current?.field === "file" ? undefined : current));
		},
		[
			invalidateSaveFn,
			result.waiting,
		],
	);
	const showValidationIssueFn = useCallback(
		(issue: { readonly field: "title" | "file"; readonly message: string }) => {
			setValidationIssueFn(issue);
			const focusInvalidFieldFn = () =>
				document
					.querySelector<HTMLElement>(
						"input[data-ui-invalid='true'], button[data-ui-invalid='true']",
					)
					?.focus();
			if (typeof requestAnimationFrame === "function") {
				requestAnimationFrame(focusInvalidFieldFn);
			} else {
				setTimeout(focusInvalidFieldFn, 0);
			}
		},
		[],
	);
	const dirty = title.trim() !== resource?.title || file !== undefined;
	const dirtyRef = useRef(dirty);
	dirtyRef.current = dirty;
	const persistFn = useCallback(async () => {
		if (
			!mountedRef.current ||
			!dirtyRef.current ||
			pendingSaveRef.current !== undefined ||
			result.waiting
		)
			return false;
		const epoch = draftEpochRef.current;
		const isCurrentFn = () => mountedRef.current && draftEpochRef.current === epoch;
		pendingSaveRef.current = epoch;
		setSavingFn(true);
		try {
			const validation = await RendererRuntime.runPromise(
				validateEditorArtworkDraftFx({
					file,
					resourceUid,
					title,
				}).pipe(
					Effect.match({
						onFailure: (issue) => ({
							issue,
						}),
						onSuccess: () => ({}),
					}),
				),
			);
			// Validation is outside the command Atom: a discarded draft must never submit later.
			if (!isCurrentFn()) return false;
			if ("issue" in validation) {
				showValidationIssueFn({
					field: validation.issue.reason === "invalid-artwork" ? "file" : "title",
					message: validation.issue.message,
				});
				return false;
			}
			setValidationIssueFn(undefined);
			const nextTitle = title.trim();
			try {
				commandEpochRef.current = epoch;
				await mutateFn({
					file,
					resourceUid,
					title: nextTitle,
				});
			} catch (error) {
				if (!isCurrentFn()) return false;

				return false;
			}
			if (!isCurrentFn()) return false;
			dirtyRef.current = false;
			setTitleStateFn(nextTitle);
			setFileStateFn(undefined);
			return true;
		} finally {
			if (pendingSaveRef.current === epoch) {
				pendingSaveRef.current = undefined;
				if (mountedRef.current) setSavingFn(false);
			}
		}
	}, [
		file,
		mutateFn,
		title,
		resource?.title,
		resourceUid,
		result.waiting,
		showValidationIssueFn,
	]);
	const saveFn = useCallback(async () => {
		const epoch = draftEpochRef.current;
		if (
			!(await persistFn()) ||
			!mountedRef.current ||
			draftEpochRef.current !== epoch ||
			admission.isNavigationBlockedFn()
		)
			return false;
		await navigateFn({
			to: "/editor/$projectId/artwork/$resourceUid/detail/overview",
			params: {
				projectId: project.projectId,
				resourceUid,
			},
			search: {
				filter,
				query,
			},
			replace: true,
		});
		return true;
	}, [
		admission,
		filter,
		navigateFn,
		resourceUid,
		persistFn,
		project.projectId,
		query,
	]);
	const resetDraftFn = useCallback(() => {
		invalidateSaveFn();
		dirtyRef.current = false;
		setTitleStateFn(resource?.title ?? "");
		setFileStateFn(undefined);
		setValidationIssueFn(undefined);
	}, [
		invalidateSaveFn,
		resource?.title,
	]);
	const discardFn = useCallback(async () => {
		if (pendingSaveRef.current !== undefined || result.waiting) return;
		resetDraftFn();
		await navigateFn({
			to: "/editor/$projectId/artwork/$resourceUid/detail/overview",
			params: {
				projectId: project.projectId,
				resourceUid,
			},
			search: {
				filter,
				query,
			},
			replace: true,
		});
	}, [
		filter,
		navigateFn,
		project.projectId,
		query,
		resetDraftFn,
		resourceUid,
		result.waiting,
	]);
	useEditorUnsavedChangesRegistration({
		discardFn: resetDraftFn,
		id: `artwork:${project.projectId}:${resourceUid}`,
		isDirtyFn: () => dirtyRef.current,
		isValidFn: async () =>
			Exit.isSuccess(
				await RendererRuntime.runPromiseExit(
					validateEditorArtworkDraftFx({
						file,
						resourceUid,
						title,
					}),
				),
			),
		ownsPathnameFn: (pathname) =>
			pathname.startsWith(`/editor/${project.projectId}/artwork/${resourceUid}/edit`),
		saveFn: persistFn,
	});
	const settledError = RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	const persistenceError =
		commandEpochRef.current === draftEpochRef.current ? settledError : undefined;
	const error =
		validationIssue === undefined
			? persistenceError
			: `${validationIssue.field === "title" ? "Title" : "Image"}: ${validationIssue.message}`;
	const resourceFound = resource !== undefined;

	return {
		titleError: validationIssue?.field === "title" ? validationIssue.message : undefined,
		currentUrl,
		dirty,
		discardFn,
		error,
		file,
		fileError: validationIssue?.field === "file" ? validationIssue.message : undefined,
		title,
		projectId: project.projectId,
		resourceFound,
		saveFn,
		saving: saving || result.waiting,
		setFileFn,
		setTitleFn,
	};
};
