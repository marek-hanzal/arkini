import { useState } from "react";
import { EditorMcpConfigurationSchema } from "../../../electron/contract/editor/EditorMcpConfigurationSchema";
import type { EditorMcpOverviewSchema } from "../../../electron/contract/editor/EditorMcpOverviewSchema";

export namespace useEditorMcpSettingsController {
	export interface Props {
		readonly onConfigure: (configuration: EditorMcpConfigurationSchema.Type) => void;
		readonly overview?: EditorMcpOverviewSchema.Type;
	}

	export interface Output {
		readonly authtoken: string;
		readonly clearError: () => void;
		readonly error?: string;
		readonly ngrokDomain: string;
		readonly port: string;
		readonly saveNgrok: () => void;
		readonly savePort: () => void;
		readonly setAuthtoken: (value: string) => void;
		readonly setNgrokDomain: (value: string) => void;
		readonly setPort: (value: string) => void;
	}
}

/** Owns unsaved MCP configuration drafts and their local validation. */
export const useEditorMcpSettingsController = ({
	onConfigure,
	overview,
}: useEditorMcpSettingsController.Props): useEditorMcpSettingsController.Output => {
	const [portDraft, setPortDraft] = useState<string>();
	const [authtoken, setAuthtoken] = useState("");
	const [ngrokDomainDraft, setNgrokDomainDraft] = useState<string>();
	const [error, setError] = useState<string>();
	const port = portDraft ?? (overview === undefined ? "" : String(overview.port));
	const ngrokDomain = ngrokDomainDraft ?? overview?.ngrokDomain ?? "";

	return {
		authtoken,
		clearError: () => setError(undefined),
		error,
		ngrokDomain,
		port,
		saveNgrok: () => {
			if (authtoken.trim() === "") {
				setError("Paste an ngrok authtoken first.");
				return;
			}
			if (ngrokDomain.trim() === "") {
				setError("Enter the assigned ngrok domain first.");
				return;
			}
			const ngrok = EditorMcpConfigurationSchema.safeParse({
				type: "ngrok",
				authtoken,
				domain: ngrokDomain,
			});
			if (!ngrok.success) {
				setError("Enter the ngrok hostname without https:// or a path.");
				return;
			}
			onConfigure(ngrok.data);
			setAuthtoken("");
			setNgrokDomainDraft(undefined);
		},
		savePort: () => {
			const candidate = Number(port);
			if (!Number.isInteger(candidate) || candidate < 1_024 || candidate > 65_535) {
				setError("Use a port from 1024 to 65535.");
				return;
			}
			onConfigure({
				type: "port",
				port: candidate,
			});
			setPortDraft(undefined);
		},
		setAuthtoken,
		setNgrokDomain: (value) => {
			setError(undefined);
			setNgrokDomainDraft(value);
		},
		setPort: (value) => {
			setError(undefined);
			setPortDraft(value);
		},
	};
};
