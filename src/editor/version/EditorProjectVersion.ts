import type { Effect } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import type { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";

export type EditorProjectVersionApplicability =
	| {
			readonly type: "applicable";
	  }
	| {
			readonly type: "incompatible";
			readonly reason: string;
	  };

/** Lightweight immutable node in one project's version tree. */
export interface EditorProjectVersionDescriptor {
	readonly applicability: EditorProjectVersionApplicability;
	readonly arkini: string;
	readonly arkpackVersion: string;
	readonly body?: string;
	readonly createdAtMs: number;
	readonly parentVersionId?: string;
	readonly projectId: string;
	readonly snapshotFormatVersion: number;
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

export interface EditorProjectVersionCheckout {
	readonly project: EditorProject;
	readonly version: EditorProjectVersionDescriptor;
}

/** Main-process version authority; renderer transport is composed in a later boundary. */
export interface EditorProjectVersionRepositoryService {
	readonly checkoutVersionFx: (
		props: EditorProjectVersionCheckoutInput,
	) => Effect.Effect<EditorProjectVersionCheckout, EditorProjectRepositoryError>;
	readonly createVersionFx: (
		props: EditorProjectVersionCommitInput,
	) => Effect.Effect<EditorProjectVersionDescriptor, EditorProjectRepositoryError>;
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
