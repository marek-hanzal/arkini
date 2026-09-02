import { useState } from "react";
import { EditorMcpConfigurationSchema } from "~/authoring-mcp/schema/EditorMcpConfigurationSchema";
import type { EditorMcpOverviewSchema } from "~/authoring-mcp/schema/EditorMcpOverviewSchema";

export namespace useEditorMcpSettingsController {
	export interface Props {
		readonly onConfigureFn: (configuration: EditorMcpConfigurationSchema.Type) => void;
		readonly overview?: EditorMcpOverviewSchema.Type;
	}

	export interface Output {
		readonly authtoken: string;
		readonly clearErrorFn: () => void;
		readonly error?: string;
		readonly ngrokDomain: string;
		readonly port: string;
		readonly saveNgrokFn: () => void;
		readonly savePortFn: () => void;
		readonly setAuthtokenFn: (value: string) => void;
		readonly setNgrokDomainFn: (value: string) => void;
		readonly setPortFn: (value: string) => void;
	}
}

/** Owns unsaved MCP configuration drafts and their local validation. */
export const useEditorMcpSettingsController = ({
	onConfigureFn,
	overview,
}: useEditorMcpSettingsController.Props): useEditorMcpSettingsController.Output => {
	const [portDraft, setPortDraftFn] = useState<string>();
	const [authtoken, setAuthtokenFn] = useState("");
	const [ngrokDomainDraft, setNgrokDomainDraftFn] = useState<string>();
	const [error, setErrorFn] = useState<string>();
	const port = portDraft ?? (overview === undefined ? "" : String(overview.port));
	const ngrokDomain = ngrokDomainDraft ?? overview?.ngrokDomain ?? "";

	return {
		authtoken,
		clearErrorFn: () => setErrorFn(undefined),
		error,
		ngrokDomain,
		port,
		saveNgrokFn: () => {
			if (authtoken.trim() === "") {
				setErrorFn("Paste an ngrok authtoken first.");
				return;
			}
			if (ngrokDomain.trim() === "") {
				setErrorFn("Enter the assigned ngrok domain first.");
				return;
			}
			const ngrok = EditorMcpConfigurationSchema.safeParse({
				type: "ngrok",
				authtoken,
				domain: ngrokDomain,
			});
			if (!ngrok.success) {
				setErrorFn("Enter the ngrok hostname without https:// or a path.");
				return;
			}
			onConfigureFn(ngrok.data);
			setAuthtokenFn("");
			setNgrokDomainDraftFn(undefined);
		},
		savePortFn: () => {
			const candidate = Number(port);
			if (!Number.isInteger(candidate) || candidate < 1_024 || candidate > 65_535) {
				setErrorFn("Use a port from 1024 to 65535.");
				return;
			}
			onConfigureFn({
				type: "port",
				port: candidate,
			});
			setPortDraftFn(undefined);
		},
		setAuthtokenFn,
		setNgrokDomainFn: (value) => {
			setErrorFn(undefined);
			setNgrokDomainDraftFn(value);
		},
		setPortFn: (value) => {
			setErrorFn(undefined);
			setPortDraftFn(value);
		},
	};
};
