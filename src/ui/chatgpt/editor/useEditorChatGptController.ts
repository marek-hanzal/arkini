import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatGptAssetCandidateSchema } from "../../../../electron/contract/chatgpt/ChatGptSurfaceSchema";

import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { EditorProjectRepository } from "~/project-authoring/service/EditorProjectRepository";
import { readEditorAssetResourceIdFn } from "~/asset-authoring/domain/fn/readEditorAssetResourceIdFn";
import { saveEditorAssetFx } from "~/asset-authoring/session/saveEditorAssetFx";
import { validateEditorAssetFileFx } from "~/asset-authoring/validation/validateEditorAssetFileFx";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorUnsavedChangesRegistration } from "~/authoring-session/ui/useEditorUnsavedChangesRegistration";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";
import { useEditorChatGptSurface } from "./useEditorChatGptSurface";

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
		readonly discard: () => void;
		readonly error?: unknown;
		readonly previewUrl?: string;
		readonly replacementApproved: boolean;
		readonly resourceId: string;
		readonly retry: () => void;
		readonly save: () => Promise<boolean>;
		readonly saving: boolean;
		readonly setResourceId: (resourceId: string) => void;
		readonly surfaceRef: RefObject<HTMLDivElement | null>;
		readonly viewState: useEditorChatGptSurface.Output["viewState"];
	}
}

const toFile = (filename: string, bytes: Uint8Array) =>
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
	(listener: (candidate: ChatGptAssetCandidateSchema.Type) => void) =>
		Effect.sync(() =>
			window.arkini.chatGpt.onAssetCandidate((candidate) =>
				listener(ChatGptAssetCandidateSchema.parse(candidate)),
			),
		),
);

const saveEditorAssetCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((projectId: string) =>
			Atom.fn((props: SaveEditorAssetCommandProps) =>
				saveEditorAssetFx({
					...props,
					projectId,
				}).pipe(Effect.provideService(EditorProjectRepository, repository)),
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

/** Owns the declarative native surface and one explicit downloaded-asset decision. */
export const useEditorChatGptController = (): useEditorChatGptController.Output => {
	const project = useEditorProject();
	const [candidate, setCandidate] = useState<AssetCandidate>();
	const candidateRef = useRef(candidate);
	candidateRef.current = candidate;
	const [candidateError, setCandidateError] = useState<unknown>();
	const candidateErrorRef = useRef(candidateError);
	candidateErrorRef.current = candidateError;
	const [candidateValidating, setCandidateValidatingState] = useState(false);
	const candidateValidatingRef = useRef(candidateValidating);
	candidateValidatingRef.current = candidateValidating;
	const [resourceId, setResourceIdState] = useState("");
	const [replacementApproval, setReplacementApproval] = useState<ReplacementApproval>();
	const commandAtom = saveEditorAssetCommandAtom(project.projectId);
	const result = useAtomValue(commandAtom);
	const mutate = useAtomSet(commandAtom, {
		mode: "promise",
	});
	const collision = project.resources.some(({ id }) => id === resourceId.trim());
	const replacementApproved =
		collision &&
		replacementApproval?.resourceId === resourceId.trim() &&
		replacementApproval.revision === project.revision;
	const dirtyRef = useRef(candidate !== undefined);
	dirtyRef.current = candidate !== undefined;
	const setCandidateValidating = (validating: boolean) => {
		candidateValidatingRef.current = validating;
		setCandidateValidatingState(validating);
	};

	useEffect(() => {
		let active = true;
		const unsubscribe = RendererRuntime.runSync(
			subscribeChatGptAssetCandidateFx((next) => {
				if (
					!active ||
					next.projectId !== project.projectId ||
					candidateRef.current !== undefined
				)
					return;
				const file = toFile(next.filename, next.bytes);
				const claimed = {
					file,
					filename: next.filename,
				};
				candidateRef.current = claimed;
				dirtyRef.current = true;
				setCandidate(claimed);
				setCandidateError(undefined);
				candidateErrorRef.current = undefined;
				setCandidateValidating(true);
				setResourceIdState(readEditorAssetResourceIdFn(next.filename));
				setReplacementApproval(undefined);
				void RendererRuntime.runPromise(
					validateEditorAssetFileFx(file, "chatgpt-preview"),
				).then(
					() => {
						if (!active || candidateRef.current !== claimed) return;
						setCandidateValidating(false);
					},
					(error) => {
						if (!active || candidateRef.current !== claimed) return;
						candidateErrorRef.current = error;
						setCandidateError(error);
						setCandidateValidating(false);
					},
				);
			}),
		);
		return () => {
			active = false;
			unsubscribe();
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

	const discard = useCallback(() => {
		dirtyRef.current = false;
		candidateRef.current = undefined;
		setCandidate(undefined);
		setCandidateError(undefined);
		candidateErrorRef.current = undefined;
		setCandidateValidating(false);
		setResourceIdState("");
		setReplacementApproval(undefined);
	}, []);
	const persist = useCallback(async () => {
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
		await mutate({
			expectedRevision: project.revision,
			file: current.file,
			overwrite,
			resourceId: id,
		});
		discard();
		return true;
	}, [
		discard,
		mutate,
		project.resources,
		project.revision,
		replacementApproval,
		resourceId,
		result.waiting,
	]);
	const save = useCallback(async () => {
		if (
			candidateRef.current === undefined ||
			candidateValidatingRef.current ||
			candidateErrorRef.current !== undefined ||
			result.waiting
		)
			return false;
		if (collision && !replacementApproved) {
			setReplacementApproval({
				resourceId: resourceId.trim(),
				revision: project.revision,
			});
			return false;
		}
		return persist();
	}, [
		collision,
		persist,
		project.revision,
		replacementApproved,
		resourceId,
		result.waiting,
	]);
	const setResourceId = useCallback((next: string) => {
		setResourceIdState(next);
		setReplacementApproval(undefined);
	}, []);
	useEditorUnsavedChangesRegistration({
		discard,
		id: `chatgpt-download:${project.projectId}`,
		isDirty: () => dirtyRef.current,
		isValid: async () => {
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
		ownsPathname: (pathname) => pathname === `/editor/${project.projectId}/chatgpt`,
		save: persist,
	});

	return {
		candidate,
		candidateError,
		candidateValidating,
		collision,
		discard,
		error: RendererRuntime.runSync(readSettledAsyncResultErrorFx(result)),
		previewUrl,
		replacementApproved,
		resourceId,
		retry: surface.retry,
		save,
		saving: result.waiting,
		setResourceId,
		surfaceRef: surface.surfaceRef,
		viewState: surface.viewState,
	};
};
