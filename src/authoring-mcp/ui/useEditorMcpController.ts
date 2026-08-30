import { useAtom } from "@effect/atom-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorMcpConfigurationSchema } from "../../../electron/contract/editor/EditorMcpConfigurationSchema";
import { EditorMcpOverviewSchema } from "../../../electron/contract/editor/EditorMcpOverviewSchema";

import { useClipboard } from "~/ui/clipboard/useClipboard";
import { EditorMcpCommandAtom } from "~/authoring-mcp/atom/EditorMcpCommandAtom";

const parseEditorMcpOverviewFn = (candidate: unknown) =>
	EditorMcpOverviewSchema.safeParse(candidate);

const parseEditorMcpConfigurationFn = (candidate: unknown) =>
	EditorMcpConfigurationSchema.safeParse(candidate);

export const useEditorMcpController = () => {
	const [state, dispatch] = useAtom(EditorMcpCommandAtom);
	const overview = "overview" in state ? state.overview : undefined;
	const [portDraft, setPortDraft] = useState<string>();
	const [authtoken, setAuthtoken] = useState("");
	const [ngrokDomainDraft, setNgrokDomainDraft] = useState<string>();
	const [localError, setLocalError] = useState<string>();
	const clipboard = useClipboard();

	useEffect(() => {
		dispatch({
			type: "read",
		});
		return window.arkini.editorMcp.onOverviewChanged((candidate) => {
			const parsed = parseEditorMcpOverviewFn(candidate);
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
	const port = portDraft ?? (overview === undefined ? "" : String(overview.port));
	const ngrokDomain = ngrokDomainDraft ?? overview?.ngrokDomain ?? "";
	const pending = state.kind === "loading" || state.kind === "pending";

	return useMemo(
		() => ({
			state,
			overview,
			pending,
			pendingAction: state.kind === "pending" ? state.action : undefined,
			port,
			authtoken,
			ngrokDomain,
			remotePassword: overview?.remotePassword,
			copied: clipboard.copied,
			error:
				localError ??
				clipboard.error ??
				(state.kind === "error" ? state.message : undefined),
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
			setNgrokDomain: (value: string) => {
				setLocalError(undefined);
				setNgrokDomainDraft(value);
			},
			saveNgrok: () => {
				if (authtoken.trim() === "") {
					setLocalError("Paste an ngrok authtoken first.");
					return;
				}
				if (ngrokDomain.trim() === "") {
					setLocalError("Enter the assigned ngrok domain first.");
					return;
				}
				const ngrok = parseEditorMcpConfigurationFn({
					type: "ngrok",
					authtoken,
					domain: ngrokDomain,
				});
				if (!ngrok.success) {
					setLocalError("Enter the ngrok hostname without https:// or a path.");
					return;
				}
				dispatch({
					type: "configure",
					configuration: ngrok.data,
				});
				setAuthtoken("");
				setNgrokDomainDraft(undefined);
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
			copy: clipboard.copy,
		}),
		[
			state,
			overview,
			pending,
			port,
			authtoken,
			ngrokDomain,
			clipboard,
			localError,
			dispatch,
			execute,
		],
	);
};
