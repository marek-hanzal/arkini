import { ExternalLink, Save } from "lucide-react";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import type { EditorMcpOverviewSchema } from "~/authoring-mcp/schema/EditorMcpOverviewSchema";

import { PrimaryButton } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { EditorValueField } from "~/editor-control/ui/EditorValueField";
import { EditorMcpCopyableUrl } from "./EditorMcpCopyableUrl";

const editorMcpInputClassName =
	"w-full rounded-lg border border-control-border bg-[var(--ak-editor-background)] px-3 py-2 text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60";

interface EditorMcpSettingsProps {
	readonly authtoken: string;
	readonly ngrokDomain: string;
	readonly onSaveNgrokFn: () => void;
	readonly onSavePortFn: () => void;
	readonly onSetAuthtokenFn: (value: string) => void;
	readonly onSetNgrokDomainFn: (value: string) => void;
	readonly onSetPortFn: (value: string) => void;
	readonly overview: EditorMcpOverviewSchema.Type;
	readonly pending: boolean;
	readonly port: string;
}

export const EditorMcpSettings = ({
	authtoken,
	ngrokDomain,
	onSaveNgrokFn,
	onSavePortFn,
	onSetAuthtokenFn,
	onSetNgrokDomainFn,
	onSetPortFn,
	overview,
	pending,
	port,
}: EditorMcpSettingsProps) => {
	const configuredDomain = overview.ngrokDomain;
	const remoteRunning = overview.remote.type === "ready" || overview.remote.type === "starting";
	const portDisabled =
		pending || overview.local.type === "ready" || overview.remote.type === "ready";
	const ngrokDisabled = pending || remoteRunning;
	const localUrl = `http://127.0.0.1:${port}/editor/mcp`;
	return (
		<div className="grid items-start gap-6 md:grid-cols-2">
			<EditorRootCard
				className="gap-3"
				dataUi="EditorMcpLocalSettingsCard"
			>
				<h2 className="font-semibold">Local server</h2>
				<EditorValueField
					as="div"
					label="Port"
					required
				>
					<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
						<input
							type="number"
							min={1_024}
							max={65_535}
							value={port}
							className={editorMcpInputClassName}
							disabled={portDisabled}
							onChange={(event) => onSetPortFn(event.currentTarget.value)}
						/>
						<LinkButton
							className="inline-flex items-center gap-2"
							disabled={pending}
							onClick={onSavePortFn}
						>
							<Save className="size-4" />
							Save
						</LinkButton>
					</div>
				</EditorValueField>
				<EditorMcpCopyableUrl url={localUrl} />
			</EditorRootCard>
			<EditorRootCard
				className="gap-3"
				dataUi="EditorMcpRemoteSettingsCard"
			>
				<div className="flex items-center justify-between gap-3">
					<h2 className="font-semibold">ngrok</h2>
					<a
						href="https://ngrok.com/"
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 text-sm text-accent opacity-75 hover:opacity-100 hover:underline"
					>
						ngrok.com
						<ExternalLink className="size-3" />
					</a>
				</div>
				<EditorValueField
					label="Development domain"
					required
				>
					<input
						value={ngrokDomain}
						className={editorMcpInputClassName}
						disabled={ngrokDisabled}
						placeholder="your-assigned-name.ngrok-free.app"
						onChange={(event) => onSetNgrokDomainFn(event.currentTarget.value)}
					/>
				</EditorValueField>
				<EditorValueField
					label="Authtoken"
					required
				>
					<input
						type="password"
						value={authtoken}
						className={editorMcpInputClassName}
						disabled={ngrokDisabled}
						placeholder={
							configuredDomain === undefined
								? "Paste ngrok authtoken"
								: "Configured — paste to replace"
						}
						onChange={(event) => onSetAuthtokenFn(event.currentTarget.value)}
					/>
				</EditorValueField>
				<PrimaryButton
					className="justify-self-start gap-2"
					disabled={ngrokDisabled}
					onClick={onSaveNgrokFn}
				>
					<Save className="size-4" />
					Save
				</PrimaryButton>
			</EditorRootCard>
		</div>
	);
};
