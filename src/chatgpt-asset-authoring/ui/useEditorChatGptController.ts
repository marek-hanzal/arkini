import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ChatGptAssetCandidateSchema,
	type ChatGptViewStateSchema,
} from "~electron/contract/chatgpt/ChatGptSurfaceSchema";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { readEditorAssetResourceIdFn } from "~/asset-authoring/fn/readEditorAssetResourceIdFn";
import { saveEditorAssetFx } from "~/asset-authoring/fx/saveEditorAssetFx";
import { validateEditorAssetFileFx } from "~/asset-authoring/fx/validateEditorAssetFileFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { readSettledAsyncResultErrorFx } from "~/ui/fx/readSettledAsyncResultErrorFx";
import { useEditorChatGptSurface } from "~/chatgpt-asset-authoring/ui/useEditorChatGptSurface";

interface AssetCandidate {
	readonly file: File;
	readonly filename: string;
}

interface ReplacementApproval {
	readonly resourceId: string;
	readonly revision: number;
}

interface SaveEditorAssetCommandProps {
	readonly expectedRevision: number;
	readonly file: File;
	readonly overwrite: boolean;
	readonly resourceId: string;
}

export namespace useEditorChatGptController {
	export interface Output {
		readonly candidate?: AssetCandidate;
		readonly candidateError?: unknown;
		readonly candidateValidating: boolean;
		readonly collision: boolean;
		readonly discardFn: () => void;
		readonly error?: unknown;
		readonly previewUrl?: string;
		readonly replacementApproved: boolean;
		readonly resourceId: string;
		readonly retryFn: () => void;
		readonly saveFn: () => Promise<boolean>;
		readonly saving: boolean;
		readonly setResourceIdFn: (resourceId: string) => void;
		readonly surfaceRef: RefObject<HTMLDivElement | null>;
		readonly viewState: ChatGptViewStateSchema.Type;
	}
}

const toFileFn = (filename: string, bytes: Uint8Array) =>
	new File(
		[
			bytes.slice().buffer as ArrayBuffer,
		],
		filename,
		{
			type: "image/png",
		},
	);

const subscribeChatGptAssetCandidateFx = Effect.fn("subscribeChatGptAssetCandidateFx")(
	(listenerFn: (candidate: ChatGptAssetCandidateSchema.Type) => void) =>
		Effect.sync(() =>
			window.arkini.chatGpt.onAssetCandidateFn((candidate) =>
				listenerFn(ChatGptAssetCandidateSchema.parse(candidate)),
			),
		),
);

const saveEditorAssetCommandAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: SaveEditorAssetCommandProps) =>
				saveEditorAssetFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(ProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

/** Owns the declarative native surface and one explicit downloaded-asset decision. */
export const useEditorChatGptController = (): useEditorChatGptController.Output => {
	const project = useEditorProject();
	const [candidate, setCandidateFn] = useState<AssetCandidate>();
	const candidateRef = useRef(candidate);
	candidateRef.current = candidate;
	const [candidateError, setCandidateErrorFn] = useState<unknown>();
	const candidateErrorRef = useRef(candidateError);
	candidateErrorRef.current = candidateError;
	const [candidateValidating, setCandidateValidatingStateFn] = useState(false);
	const candidateValidatingRef = useRef(candidateValidating);
	candidateValidatingRef.current = candidateValidating;
	const [resourceId, setResourceIdStateFn] = useState("");
	const [replacementApproval, setReplacementApprovalFn] = useState<ReplacementApproval>();
	const commandAtom = saveEditorAssetCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const mutateFn = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const collision = project.resources.some(({ id }) => id === resourceId.trim());
	const replacementApproved =
		collision &&
		replacementApproval?.resourceId === resourceId.trim() &&
		replacementApproval.revision === project.revision;
	const dirtyRef = useRef(candidate !== undefined);
	dirtyRef.current = candidate !== undefined;
	const setCandidateValidatingFn = (validating: boolean) => {
		candidateValidatingRef.current = validating;
		setCandidateValidatingStateFn(validating);
	};

	useEffect(() => {
		let active = true;
		const unsubscribeFn = RendererRuntime.runSync(
			subscribeChatGptAssetCandidateFx((next) => {
				if (
					!active ||
					next.projectId !== project.projectId ||
					candidateRef.current !== undefined
				)
					return;
				const file = toFileFn(next.filename, next.bytes);
				const claimed = {
					file,
					filename: next.filename,
				};
				candidateRef.current = claimed;
				dirtyRef.current = true;
				setCandidateFn(claimed);
				setCandidateErrorFn(undefined);
				candidateErrorRef.current = undefined;
				setCandidateValidatingFn(true);
				setResourceIdStateFn(readEditorAssetResourceIdFn(next.filename));
				setReplacementApprovalFn(undefined);
				void RendererRuntime.runPromise(
					validateEditorAssetFileFx(file, "chatgpt-preview"),
				).then(
					() => {
						if (!active || candidateRef.current !== claimed) return;
						setCandidateValidatingFn(false);
					},
					(error) => {
						if (!active || candidateRef.current !== claimed) return;
						candidateErrorRef.current = error;
						setCandidateErrorFn(error);
						setCandidateValidatingFn(false);
					},
				);
			}),
		);
		return () => {
			active = false;
			unsubscribeFn();
		};
	}, [
		project.projectId,
	]);

	const surfaceVisible = candidate === undefined && candidateError === undefined;
	const surface = useEditorChatGptSurface({
		projectId: project.projectId,
		visible: surfaceVisible,
	});

	const previewUrl = useMemo(
		() => (candidate === undefined ? undefined : URL.createObjectURL(candidate.file)),
		[
			candidate,
		],
	);
	useEffect(
		() => () => {
			if (previewUrl !== undefined) URL.revokeObjectURL(previewUrl);
		},
		[
			previewUrl,
		],
	);

	const discardFn = useCallback(() => {
		dirtyRef.current = false;
		candidateRef.current = undefined;
		setCandidateFn(undefined);
		setCandidateErrorFn(undefined);
		candidateErrorRef.current = undefined;
		setCandidateValidatingFn(false);
		setResourceIdStateFn("");
		setReplacementApprovalFn(undefined);
	}, []);
	const persistFn = useCallback(async () => {
		const current = candidateRef.current;
		if (
			current === undefined ||
			candidateValidatingRef.current ||
			candidateErrorRef.current !== undefined ||
			result.waiting
		)
			return false;
		const id = resourceId.trim();
		const currentCollision = project.resources.some((resource) => resource.id === id);
		const overwrite =
			currentCollision &&
			replacementApproval?.resourceId === id &&
			replacementApproval.revision === project.revision;
		if (currentCollision && !overwrite) return false;
		await mutateFn({
			expectedRevision: project.revision,
			file: current.file,
			overwrite,
			resourceId: id,
		});
		discardFn();
		return true;
	}, [
		discardFn,
		mutateFn,
		project.resources,
		project.revision,
		replacementApproval,
		resourceId,
		result.waiting,
	]);
	const saveFn = async () => {
		if (
			candidateRef.current === undefined ||
			candidateValidatingRef.current ||
			candidateErrorRef.current !== undefined ||
			result.waiting
		)
			return false;
		if (collision && !replacementApproved) {
			setReplacementApprovalFn({
				resourceId: resourceId.trim(),
				revision: project.revision,
			});
			return false;
		}
		return persistFn();
	};
	const setResourceIdFn = (next: string) => {
		setResourceIdStateFn(next);
		setReplacementApprovalFn(undefined);
	};
	useEditorUnsavedChangesRegistration({
		discardFn,
		id: `chatgpt-download:${project.projectId}`,
		isDirtyFn: () => dirtyRef.current,
		isValidFn: async () => {
			const current = candidateRef.current;
			if (
				current === undefined ||
				candidateValidatingRef.current ||
				candidateErrorRef.current !== undefined ||
				(collision && !replacementApproved)
			)
				return false;
			return Exit.isSuccess(
				await RendererRuntime.runPromiseExit(
					validateEditorAssetFileFx(current.file, resourceId.trim()),
				),
			);
		},
		ownsPathnameFn: (pathname) => pathname === `/editor/${project.projectId}/chatgpt`,
		saveFn: persistFn,
	});

	return {
		candidate,
		candidateError,
		candidateValidating,
		collision,
		discardFn,
		error: RendererRuntime.runSync(readSettledAsyncResultErrorFx(result)),
		previewUrl,
		replacementApproved,
		resourceId,
		retryFn: surface.retryFn,
		saveFn,
		saving: result.waiting,
		setResourceIdFn,
		surfaceRef: surface.surfaceRef,
		viewState: surface.viewState,
	};
};
