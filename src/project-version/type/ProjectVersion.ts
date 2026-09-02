import type { Effect } from "effect";

import type { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type {
	ProjectCompatibilityDiffResult,
	ProjectCompatibilityResult,
} from "~/project-version/type/ProjectCompatibility";

export interface ProjectVersionCommitPreview {
	readonly bump: ProjectCompatibilityResult;
	readonly canCommit: boolean;
	readonly currentFingerprint: string;
	readonly diff?: ProjectVersionDiff;
	readonly initial: boolean;
	readonly nextArkpackVersion: string;
	readonly scenariosToDelete: ReadonlyArray<string>;
}

/** Lightweight immutable node in one project's version tree. */
export interface ProjectVersionDescriptor {
	readonly arkini: string;
	readonly arkpackVersion: string;
	readonly body?: string;
	readonly createdAtMs: number;
	readonly parentVersionId?: string;
	readonly projectId: string;
	readonly sourceRevision: number;
	readonly subject: string;
	readonly tag?: string;
	readonly versionId: string;
}

export interface ProjectVersionStatus {
	readonly canCommit: boolean;
	readonly currentBaseVersionId?: string;
	readonly currentFingerprint: string;
	readonly dirty: boolean;
	readonly versionCount: number;
}

export interface ProjectVersionCommitInput {
	readonly body?: string;
	readonly expectedFingerprint?: string;
	readonly projectId: string;
	readonly subject: string;
	readonly tag?: string;
}

export interface ProjectVersionCheckoutInput {
	readonly expectedFingerprint?: string;
	readonly projectId: string;
	readonly versionId: string;
}

export interface ProjectVersionTagInput {
	readonly projectId: string;
	readonly tag?: string;
	readonly versionId: string;
}

export type ProjectVersionReference =
	| {
			readonly type: "current";
	  }
	| {
			readonly type: "version";
			readonly versionId: string;
	  };

export interface ProjectVersionDiffInput {
	readonly projectId: string;
	readonly from: ProjectVersionReference;
	readonly to: ProjectVersionReference;
}

export interface ProjectVersionValueChange {
	readonly path: string;
	readonly before?: unknown;
	readonly after?: unknown;
	readonly bump?: ProjectCompatibilityDiffResult;
}

export interface ProjectVersionItemDiff {
	readonly change: "added" | "changed" | "deleted";
	readonly uid: string;
	readonly values: ReadonlyArray<ProjectVersionValueChange>;
}

export interface ProjectVersionBinaryDiff {
	readonly change: "added" | "changed" | "deleted";
	readonly bump?: ProjectCompatibilityDiffResult;
	readonly id: string;
}

export interface ProjectVersionDiff {
	readonly from: ProjectVersionReference;
	readonly to: ProjectVersionReference;
	readonly hasChanges: boolean;
	readonly project: ReadonlyArray<ProjectVersionValueChange>;
	readonly items: ReadonlyArray<ProjectVersionItemDiff>;
	readonly resources: ReadonlyArray<ProjectVersionBinaryDiff>;
	readonly scenarios: ReadonlyArray<ProjectVersionBinaryDiff>;
}

/** Main-process version authority; renderer transport is composed in a later boundary. */
export interface ProjectVersionRepositoryService {
	readonly checkoutVersionFx: (
		props: ProjectVersionCheckoutInput,
	) => Effect.Effect<void, ProjectRepositoryError, never>;
	readonly createVersionFx: (
		props: ProjectVersionCommitInput,
	) => Effect.Effect<ProjectVersionDescriptor, ProjectRepositoryError, never>;
	readonly diffVersionsFx: (
		props: ProjectVersionDiffInput,
	) => Effect.Effect<ProjectVersionDiff, ProjectRepositoryError, never>;
	readonly listVersionsFx: (
		projectId: string,
	) => Effect.Effect<ReadonlyArray<ProjectVersionDescriptor>, ProjectRepositoryError, never>;
	readonly previewVersionCommitFx: (
		projectId: string,
	) => Effect.Effect<ProjectVersionCommitPreview, ProjectRepositoryError, never>;
	readonly readVersionStatusFx: (
		projectId: string,
	) => Effect.Effect<ProjectVersionStatus, ProjectRepositoryError, never>;
	readonly updateVersionTagFx: (
		props: ProjectVersionTagInput,
	) => Effect.Effect<ProjectVersionDescriptor, ProjectRepositoryError, never>;
}
