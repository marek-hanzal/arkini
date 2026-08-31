import { useState } from "react";

export namespace useEditorMcpClipboardController {
	export interface Output {
		readonly copied?: string;
		readonly copyFn: (key: string, value: string) => Promise<void>;
		readonly error?: string;
	}
}

/** Owns transient clipboard settlement for MCP credentials and endpoints. */
export const useEditorMcpClipboardController = (): useEditorMcpClipboardController.Output => {
	const [copied, setCopiedFn] = useState<string>();
	const [error, setErrorFn] = useState<string>();

	return {
		copied,
		copyFn: async (key, value) => {
			setCopiedFn(undefined);
			setErrorFn(undefined);
			try {
				await window.arkini.clipboard.writeTextFn(value);
				setCopiedFn(key);
			} catch (cause) {
				setErrorFn(cause instanceof Error ? cause.message : String(cause));
			}
		},
		error,
	};
};
