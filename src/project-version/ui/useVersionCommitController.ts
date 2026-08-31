import { useRouter, useSearch } from "@tanstack/react-router";
import { Effect } from "effect";
import { useCallback, useEffect, useState } from "react";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { readProjectVersionHistoryFx } from "~/project-version/fx/readProjectVersionHistoryFx";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { ProjectVersionStatus } from "~/project-version/type/ProjectVersion";

const messageFn = (error: unknown) => (error instanceof Error ? error.message : String(error));

export namespace useVersionCommitController {
	export interface Output {
		readonly body: string;
		readonly canCommit: boolean;
		readonly commitFn: () => void;
		readonly error?: string;
		readonly pending: boolean;
		readonly projectId: string;
		readonly setBodyFn: (value: string) => void;
		readonly setSubjectFn: (value: string) => void;
		readonly setTagFn: (value: string) => void;
		readonly status?: ProjectVersionStatus;
		readonly subject: string;
		readonly tag: string;
	}
}

export const useVersionCommitController = (): useVersionCommitController.Output => {
	const project = useEditorProject();
	const router = useRouter();
	const { returnTo } = useSearch({
		from: "/editor/$projectId/versions/commit",
	});
	const [body, setBodyFn] = useState("");
	const [error, setErrorFn] = useState<string>();
	const [pending, setPendingFn] = useState(false);
	const [status, setStatusFn] = useState<ProjectVersionStatus>();
	const [subject, setSubjectFn] = useState("");
	const [tag, setTagFn] = useState("");

	const loadStatusFn = useCallback(() => {
		let mounted = true;
		void RendererRuntime.runPromise(readProjectVersionHistoryFx(project.projectId))
			.then((history) => {
				if (mounted) setStatusFn(history.status);
			})
			.catch((cause) => {
				if (mounted) setErrorFn(messageFn(cause));
			});
		return () => {
			mounted = false;
		};
	}, [
		project.projectId,
	]);
	useEffect(() => {
		let disposeLoadFn = loadStatusFn();
		const unsubscribeFn = window.arkini.editor.onProjectChangedFn((projectId) => {
			if (projectId !== project.projectId) return;
			disposeLoadFn();
			disposeLoadFn = loadStatusFn();
		});
		return () => {
			disposeLoadFn();
			unsubscribeFn();
		};
	}, [
		loadStatusFn,
		project.projectId,
	]);

	const canCommit =
		status?.canCommit === true && subject.trim().length > 0 && subject.trim().length <= 120;
	const commitFn = () => {
		if (!canCommit || status === undefined || pending) return;
		setPendingFn(true);
		setErrorFn(undefined);
		void RendererRuntime.runPromise(
			Effect.flatMap(ProjectRepository, (repository) =>
				repository.createVersionFx({
					...(body.trim() === ""
						? {}
						: {
								body,
							}),
					expectedFingerprint: status.currentFingerprint,
					projectId: project.projectId,
					subject,
					...(tag.trim() === ""
						? {}
						: {
								tag,
							}),
				}),
			),
		)
			.then(async () => {
				if (
					returnTo !== undefined &&
					returnTo.startsWith(`/editor/${encodeURIComponent(project.projectId)}/`)
				) {
					router.history.push(returnTo);
					return;
				}
				await router.navigate({
					to: "/editor/$projectId/versions/history",
					params: {
						projectId: project.projectId,
					},
				});
			})
			.catch((cause) => {
				setErrorFn(messageFn(cause));
				setPendingFn(false);
			});
	};

	return {
		body,
		canCommit,
		commitFn,
		...(error === undefined
			? {}
			: {
					error,
				}),
		pending,
		projectId: project.projectId,
		setBodyFn,
		setSubjectFn,
		setTagFn,
		...(status === undefined
			? {}
			: {
					status,
				}),
		subject,
		tag,
	};
};
