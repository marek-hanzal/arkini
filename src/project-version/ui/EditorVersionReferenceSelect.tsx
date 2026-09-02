import { useMemo } from "react";

import type { ProjectVersionDescriptor } from "~/project-version/type/ProjectVersion";
import {
	EditorSearchCombobox,
	type EditorSearchOption,
} from "~/editor-control/ui/EditorSearchCombobox";

const VersionReferenceOptionContent = ({
	version,
}: {
	readonly version: ProjectVersionDescriptor;
}) => {
	const createdAt = new Date(version.createdAtMs);
	return (
		<span className="grid min-w-0 flex-1 gap-0.5">
			<span className="flex min-w-0 items-baseline gap-1.5 text-sm text-foreground">
				<time
					className="shrink-0 text-xs text-muted"
					dateTime={createdAt.toISOString()}
				>
					{createdAt.toLocaleString()}
				</time>
				<span className="shrink-0 text-subtle">*</span>
				<span className="min-w-0 truncate font-semibold">{version.subject}</span>
			</span>
			{version.body === undefined ? null : (
				<span className="truncate text-xs text-muted">{version.body}</span>
			)}
			<span className="flex min-w-0 items-center gap-1.5 text-xs text-subtle">
				<span className="shrink-0 font-semibold text-accent">
					v{version.arkpackVersion}
				</span>
				{version.tag === undefined ? null : (
					<>
						<span className="shrink-0">*</span>
						<span className="min-w-0 truncate">{version.tag}</span>
					</>
				)}
			</span>
		</span>
	);
};

export const EditorVersionReferenceSelect = ({
	label,
	onChangeFn,
	value,
	versions,
}: {
	readonly label: string;
	readonly onChangeFn: (value: string) => void;
	readonly value: string;
	readonly versions: ReadonlyArray<ProjectVersionDescriptor>;
}) => {
	const versionsById = useMemo(
		() =>
			new Map(
				versions.map((version) => [
					version.versionId,
					version,
				]),
			),
		[
			versions,
		],
	);
	const options = useMemo<ReadonlyArray<EditorSearchOption>>(
		() => [
			{
				id: "current",
				label: "Working copy",
				terms: [
					"Working copy",
				],
			},
			...versions.map((version) => ({
				id: version.versionId,
				label: `${new Date(version.createdAtMs).toLocaleString()} * ${version.subject}`,
				terms: [
					version.subject,
					...(version.body === undefined
						? []
						: [
								version.body,
							]),
					...(version.tag === undefined
						? []
						: [
								version.tag,
							]),
				],
			})),
		],
		[
			versions,
		],
	);

	return (
		<EditorSearchCombobox
			displaySelectedLabel
			emptyLabel="No version matches this search."
			label={label}
			onChangeFn={onChangeFn}
			options={options}
			renderOptionContentFn={(option) => {
				const version = versionsById.get(option.id);
				return version === undefined ? (
					<span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
						{option.label}
					</span>
				) : (
					<VersionReferenceOptionContent version={version} />
				);
			}}
			renderPreviewFn={() => null}
			value={value}
		/>
	);
};
