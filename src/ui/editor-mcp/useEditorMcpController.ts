import { useAtom } from "@effect/atom-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EditorMcpOverviewSchema } from "../../../electron/contract/editor/EditorMcpOverviewSchema";
import { EditorMcpCommandAtom } from "~/ui/editor-mcp/EditorMcpCommandAtom";

export const useEditorMcpController = () => {
	const [state, dispatch] = useAtom(EditorMcpCommandAtom);
	const overview = "overview" in state ? state.overview : undefined;
	const [portDraft, setPortDraft] = useState<string>();
	const [authtoken, setAuthtoken] = useState("");
	const [localError, setLocalError] = useState<string>();
	const [copied, setCopied] = useState<string>();

	useEffect(() => {
		dispatch({
			type: "read",
		});
		return window.arkini.editorMcp.onOverviewChanged((candidate) => {
			const parsed = EditorMcpOverviewSchema.safeParse(candidate);
			if (!parsed.success) return;
			dispatch({
				type: "synchronize",
				overview: parsed.data,
			});
		});
	}, [
		dispatch,
	]);

	const execute = useCallback(
		(
			command: Parameters<typeof dispatch>[0] & {
				readonly type: "execute";
			},
		) => {
			setLocalError(undefined);
			dispatch(command);
		},
		[
			dispatch,
		],
	);
	const copy = useCallback(async (label: string, value: string) => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(label);
		} catch (cause) {
			setLocalError(cause instanceof Error ? cause.message : String(cause));
		}
	}, []);
	const port = portDraft ?? (overview === undefined ? "" : String(overview.port));
	const pending = state.kind === "loading" || state.kind === "pending";

	return useMemo(
		() => ({
			state,
			overview,
			pending,
			pendingAction: state.kind === "pending" ? state.action : undefined,
			port,
			authtoken,
			secret: "secret" in state ? state.secret : undefined,
			copied,
			error: localError ?? (state.kind === "error" ? state.message : undefined),
			setPort: (value: string) => {
				setLocalError(undefined);
				setPortDraft(value);
			},
			savePort: () => {
				const candidate = Number(port);
				if (!Number.isInteger(candidate) || candidate < 1_024 || candidate > 65_535) {
					setLocalError("Use a port from 1024 to 65535.");
					return;
				}
				dispatch({
					type: "configure",
					configuration: {
						type: "port",
						port: candidate,
					},
				});
				setPortDraft(undefined);
			},
			setAuthtoken,
			saveAuthtoken: () => {
				if (authtoken.trim() === "") {
					setLocalError("Paste an ngrok authtoken first.");
					return;
				}
				dispatch({
					type: "configure",
					configuration: {
						type: "ngrok-authtoken",
						authtoken,
					},
				});
				setAuthtoken("");
			},
			startLocal: () =>
				execute({
					type: "execute",
					command: "start-local",
				}),
			stopLocal: () =>
				execute({
					type: "execute",
					command: "stop-local",
				}),
			startRemote: () =>
				execute({
					type: "execute",
					command: "start-remote",
				}),
			stopRemote: () =>
				execute({
					type: "execute",
					command: "stop-remote",
				}),
			resetAuth: () =>
				execute({
					type: "execute",
					command: "reset-remote-auth",
				}),
			dismissSecret: () =>
				dispatch({
					type: "dismiss-secret",
				}),
			copy,
		}),
		[
			state,
			overview,
			pending,
			port,
			authtoken,
			copied,
			localError,
			dispatch,
			execute,
			copy,
		],
	);
};

export type EditorMcpController = ReturnType<typeof useEditorMcpController>;
