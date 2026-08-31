import type { Effect } from "effect";

import type { EditorProjectRepositoryError } from "~/project-authoring/error/EditorProjectRepositoryError";
import type { EditorProjectCompatibilityDiffResult } from "~/project-version/type/EditorProjectCompatibility";

/** Lightweight immutable node in one project's version tree. */
export interface EditorProjectVersionDescriptor {
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

export interface EditorProjectVersionStatus {
	readonly canCommit: boolean;
	readonly currentBaseVersionId?: string;
	readonly currentFingerprint: string;
	readonly dirty: boolean;
	readonly versionCount: number;
}

export interface EditorProjectVersionCommitInput {
	readonly body?: string;
	readonly expectedFingerprint?: string;
	readonly projectId: string;
	readonly subject: string;
	readonly tag?: string;
}

export interface EditorProjectVersionCheckoutInput {
	readonly expectedFingerprint?: string;
	readonly projectId: string;
	readonly versionId: string;
}

export interface EditorProjectVersionTagInput {
	readonly projectId: string;
	readonly tag?: string;
	readonly versionId: string;
}

export type EditorProjectVersionReference =
	| {
			readonly type: "current";
	  }
	| {
			readonly type: "version";
			readonly versionId: string;
	  };

export interface EditorProjectVersionDiffInput {
	readonly projectId: string;
	readonly from: EditorProjectVersionReference;
	readonly to: EditorProjectVersionReference;
}

export interface EditorProjectVersionValueChange {
	readonly path: string;
	readonly before?: unknown;
	readonly after?: unknown;
	readonly bump?: EditorProjectCompatibilityDiffResult;
}

export interface EditorProjectVersionItemDiff {
	readonly change: "added" | "changed" | "deleted";
	readonly uid: string;
	readonly values: ReadonlyArray<EditorProjectVersionValueChange>;
}

export interface EditorProjectVersionBinaryDiff {
	readonly change: "added" | "changed" | "deleted";
	readonly bump?: EditorProjectCompatibilityDiffResult;
	readonly id: string;
}

export interface EditorProjectVersionDiff {
	readonly from: EditorProjectVersionReference;
	readonly to: EditorProjectVersionReference;
	readonly hasChanges: boolean;
	readonly project: ReadonlyArray<EditorProjectVersionValueChange>;
	readonly items: ReadonlyArray<EditorProjectVersionItemDiff>;
	readonly resources: ReadonlyArray<EditorProjectVersionBinaryDiff>;
	readonly scenarios: ReadonlyArray<EditorProjectVersionBinaryDiff>;
}

/** Main-process version authority; renderer transport is composed in a later boundary. */
export interface EditorProjectVersionRepositoryService {
	readonly checkoutVersionFx: (
		props: EditorProjectVersionCheckoutInput,
	) => Effect.Effect<void, EditorProjectRepositoryError>;
	readonly createVersionFx: (
		props: EditorProjectVersionCommitInput,
	) => Effect.Effect<EditorProjectVersionDescriptor, EditorProjectRepositoryError>;
	readonly diffVersionsFx: (
		props: EditorProjectVersionDiffInput,
	) => Effect.Effect<EditorProjectVersionDiff, EditorProjectRepositoryError>;
	readonly listVersionsFx: (
		projectId: string,
	) => Effect.Effect<ReadonlyArray<EditorProjectVersionDescriptor>, EditorProjectRepositoryError>;
	readonly readVersionStatusFx: (
		projectId: string,
	) => Effect.Effect<EditorProjectVersionStatus, EditorProjectRepositoryError>;
	readonly updateVersionTagFx: (
		props: EditorProjectVersionTagInput,
	) => Effect.Effect<EditorProjectVersionDescriptor, EditorProjectRepositoryError>;
}
