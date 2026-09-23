import { useNavigate } from "@tanstack/react-router";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { deleteEditorResourceFx } from "~/resource-authoring/fx/deleteEditorResourceFx";

export namespace useEditorAudioResourceDeleteController {
	export interface Props {
		readonly resourceUid: string;
		readonly type: "music" | "sfx";
	}
	export interface Output {
		readonly confirming: boolean;
		readonly deleting: boolean;
		readonly error: unknown;
		readonly openFn: () => void;
		readonly cancelFn: () => void;
		readonly confirmFn: () => Promise<void>;
	}
}

/** Confirms audio deletion and leaves its original detail before canonical publication removes it. */
export const useEditorAudioResourceDeleteController = ({
	resourceUid,
	type,
}: useEditorAudioResourceDeleteController.Props): useEditorAudioResourceDeleteController.Output => {
	const project = useEditorProject();
	const navigateFn = useNavigate();
	const [confirming, setConfirmingFn] = useState(false);
	const [deleting, setDeletingFn] = useState(false);
	const [error, setErrorFn] = useState<unknown>();
	const pendingRef = useRef(false);
	const sessionRef = useRef(0);
	useLayoutEffect(
		() => () => {
			sessionRef.current += 1;
		},
		[
			project.projectId,
			resourceUid,
		],
	);
	const openFn = useCallback(() => {
		if (!pendingRef.current) setConfirmingFn(true);
	}, []);
	const cancelFn = useCallback(() => {
		if (!pendingRef.current) setConfirmingFn(false);
	}, []);
	const confirmFn = useCallback(async () => {
		if (!confirming || pendingRef.current) return;
		const session = sessionRef.current;
		pendingRef.current = true;
		setDeletingFn(true);
		setErrorFn(undefined);
		try {
			await RendererRuntime.runPromise(
				deleteEditorResourceFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					resourceUid,
					onDeletedFn: async () => {
						if (sessionRef.current !== session) return;
						await navigateFn({
							to:
								type === "music"
									? "/editor/$projectId/music"
									: "/editor/$projectId/sfx",
							params: {
								projectId: project.projectId,
							},
							replace: true,
						});
					},
				}),
			);
		} catch (cause) {
			if (sessionRef.current === session) setErrorFn(cause);
		} finally {
			pendingRef.current = false;
			if (sessionRef.current === session) setDeletingFn(false);
		}
	}, [
		confirming,
		navigateFn,
		project.projectId,
		project.revision,
		resourceUid,
		type,
	]);
	return {
		confirming,
		deleting,
		error,
		openFn,
		cancelFn,
		confirmFn,
	};
};
