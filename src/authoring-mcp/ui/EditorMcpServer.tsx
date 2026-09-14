import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { Globe, Laptop } from "lucide-react";
import type { EditorMcpOverviewSchema } from "~/authoring-mcp/schema/EditorMcpOverviewSchema";

import { PrimaryButton } from "~/ui/ui/Button";
import { Status } from "~/ui/ui/Status";
import { EditorMcpCopyableUrl } from "./EditorMcpCopyableUrl";
import { EditorMcpStatus } from "./EditorMcpStatus";

interface EditorMcpServerProps {
	readonly onStartLocalFn: () => void;
	readonly onStartRemoteFn: () => void;
	readonly onStopLocalFn: () => void;
	readonly onStopRemoteFn: () => void;
	readonly overview: EditorMcpOverviewSchema.Type;
	readonly pending: boolean;
}

export const EditorMcpServer = ({
	onStartLocalFn,
	onStartRemoteFn,
	onStopLocalFn,
	onStopRemoteFn,
	overview,
	pending,
}: EditorMcpServerProps) => {
	const localUrl =
		overview.local.type === "ready"
			? `http://127.0.0.1:${overview.local.port}/editor/mcp`
			: `http://127.0.0.1:${overview.port}/editor/mcp`;
	const remoteUrl =
		overview.remote.type === "ready"
			? overview.remote.url
			: overview.ngrokDomain === undefined
				? undefined
				: `https://${overview.ngrokDomain}/remote/mcp`;
	return (
		<div
			className="grid items-start gap-6 md:grid-cols-2"
			data-ui="EditorMcpTransports"
		>
			<EditorRootCard dataUi="EditorMcpLocalTransport">
				<Status
					variant="flat"
					size="large"
					icon={Laptop}
					title="Local MCP"
					action={
						<div className="grid justify-items-center gap-4">
							<EditorMcpCopyableUrl url={localUrl} />
							{overview.local.type === "unavailable" ? (
								<EditorMcpStatus
									message={overview.local.message}
									tone="danger"
								/>
							) : null}
							{overview.local.type === "ready" ? (
								<PrimaryButton
									disabled={pending}
									onClick={onStopLocalFn}
								>
									Stop Local MCP
								</PrimaryButton>
							) : (
								<PrimaryButton
									disabled={pending}
									onClick={onStartLocalFn}
								>
									Start Local MCP
								</PrimaryButton>
							)}
						</div>
					}
				/>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorMcpRemoteTransport">
				<Status
					variant="flat"
					size="large"
					icon={Globe}
					title="Remote MCP"
					action={
						<div className="grid justify-items-center gap-4">
							<EditorMcpCopyableUrl url={remoteUrl} />
							{overview.remote.type === "unavailable" ||
							overview.remote.type === "starting" ? (
								<EditorMcpStatus
									message={
										overview.remote.type === "unavailable"
											? overview.remote.message
											: "Starting tunnel and checking OAuth…"
									}
									tone={
										overview.remote.type === "unavailable" ? "danger" : "muted"
									}
								/>
							) : null}
							{overview.remote.type === "ready" ? (
								<PrimaryButton
									disabled={pending}
									onClick={onStopRemoteFn}
								>
									Stop Remote MCP
								</PrimaryButton>
							) : (
								<PrimaryButton
									disabled={pending || overview.ngrokDomain === undefined}
									onClick={onStartRemoteFn}
								>
									Start Remote MCP
								</PrimaryButton>
							)}
						</div>
					}
				/>
			</EditorRootCard>
		</div>
	);
};
