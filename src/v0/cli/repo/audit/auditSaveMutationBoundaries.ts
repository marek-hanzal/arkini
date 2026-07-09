import { readFileSync } from "node:fs";
import type { AuditFinding } from "./AuditFinding";
import { readFiles } from "./readAuditFiles";

const shouldIgnoreSourceFile = (path: string) =>
	!/\.tsx?$/.test(path) || /[.](?:test|spec)[.]tsx?$/.test(path);

export const auditBoardItemRemovalBoundaries = (): AuditFinding[] =>
	readFiles("src").flatMap((path) => {
		if (shouldIgnoreSourceFile(path)) return [];
		if (path === "src/board/removeBoardItemFromSaveFx.ts") return [];

		const text = readFileSync(path, "utf8");
		if (!/delete\s+[^;]*\.board\.items\s*\[/.test(text)) return [];

		return [
			{
				path,
				message:
					"board item removal must go through removeBoardItemFromSaveFx so runtime-state cleanup/preservation is explicit",
			},
		];
	});

const boardItemWriteBoundaryPaths = new Set([
	"src/board/writeBoardItemToSaveFx.ts",
]);

export const auditBoardItemWriteBoundaries = (): AuditFinding[] =>
	readFiles("src").flatMap((path) => {
		if (shouldIgnoreSourceFile(path)) return [];
		if (boardItemWriteBoundaryPaths.has(path)) return [];

		const text = readFileSync(path, "utf8");
		if (!/\.board\.items\s*\[[^\]]+\]\s*=/.test(text)) return [];

		return [
			{
				path,
				message:
					"board item writes must go through writeBoardItemToSaveFx so placement/replacement lifecycle changes stay grepable",
			},
		];
	});

const runtimeStateWriteBoundaryPaths = new Set([
	"src/board-memory/removeBoardMemoryLayoutFromSaveFx.ts",
	"src/board-memory/writeBoardMemoryLayoutToSaveFx.ts",
	"src/capacity/removeItemCapacityStateFromSaveFx.ts",
	"src/capacity/writeItemCapacityStateToSaveFx.ts",
	"src/producer/removeProducerChargeStateFromSaveFx.ts",
	"src/producer/removeProducerLineStateFromSaveFx.ts",
	"src/producer/writeProducerChargeStateToSaveFx.ts",
	"src/producer/writeProducerLineStateToSaveFx.ts",
]);

export const auditRuntimeStateWriteBoundaries = (): AuditFinding[] =>
	readFiles("src").flatMap((path) => {
		if (shouldIgnoreSourceFile(path)) return [];
		if (runtimeStateWriteBoundaryPaths.has(path)) return [];

		const text = readFileSync(path, "utf8");
		if (
			!/(?:delete\s+[^;]*\.(?:boardMemoryLayouts|itemCapacities|lines|producerCharges)\s*\[|\.(?:boardMemoryLayouts|itemCapacities|lines|producerCharges)\s*\[[^\]]+\]\s*=)/.test(
				text,
			)
		) {
			return [];
		}

		return [
			{
				path,
				message:
					"runtime state writes/removals must go through named Fx boundaries so board/producer lifecycle changes stay grepable",
			},
		];
	});

const inventorySlotWriteBoundaryPaths = new Set([
	"src/inventory/writeInventorySlotFx.ts",
]);

export const auditInventorySlotWriteBoundaries = (): AuditFinding[] =>
	readFiles("src").flatMap((path) => {
		if (shouldIgnoreSourceFile(path)) return [];
		if (inventorySlotWriteBoundaryPaths.has(path)) return [];

		const text = readFileSync(path, "utf8");
		if (
			!/(?:\.inventory\.slots\s*\[[^\]]+\]\s*=|(?:^|[^A-Za-z0-9_.])(?:props\.)?slots\s*\[[^\]]+\]\s*=|\bslot\.quantity\s*(?:[+\-*/]?=|\+\+|--))/.test(
				text,
			)
		) {
			return [];
		}

		return [
			{
				path,
				message:
					"inventory slot writes must go through writeInventorySlotFx so stack/instance slot lifecycle changes stay grepable",
			},
		];
	});

const jobRemovalBoundaryPaths = new Set([
	"src/board/removeBoardItemRuntimeStateFx.ts",
	"src/craft/removeCraftJobFromSaveFx.ts",
	"src/job/removeItemSpawnJobFromSaveFx.ts",
	"src/producer/removeProducerJobFromSaveFx.ts",
]);

export const auditJobRemovalBoundaries = (): AuditFinding[] =>
	readFiles("src").flatMap((path) => {
		if (shouldIgnoreSourceFile(path)) return [];
		if (jobRemovalBoundaryPaths.has(path)) return [];

		const text = readFileSync(path, "utf8");
		if (!/delete\s+[^;]*\.(?:producerJobs|craftJobs|itemSpawnJobs)\s*\[/.test(text)) {
			return [];
		}

		return [
			{
				path,
				message:
					"job removal must go through a named job-removal Fx boundary; board item runtime cleanup is the only cascade exception",
			},
		];
	});

const jobWriteBoundaryPaths = new Set([
	"src/craft/writeCraftJobToSaveFx.ts",
	"src/job/writeItemSpawnJobToSaveFx.ts",
	"src/producer/writeProducerJobToSaveFx.ts",
]);

export const auditJobWriteBoundaries = (): AuditFinding[] =>
	readFiles("src").flatMap((path) => {
		if (shouldIgnoreSourceFile(path)) return [];
		if (jobWriteBoundaryPaths.has(path)) return [];

		const text = readFileSync(path, "utf8");
		if (!/\.(?:producerJobs|craftJobs|itemSpawnJobs)\s*\[[^\]]+\]\s*=/.test(text)) {
			return [];
		}

		return [
			{
				path,
				message:
					"job writes must go through named job-write Fx boundaries so lifecycle updates stay grepable",
			},
		];
	});

const activeEffectWriteBoundaryPaths = new Set([
	"src/effects/removeActiveEffectFromSaveFx.ts",
	"src/effects/writeActiveEffectToSaveFx.ts",
]);

export const auditActiveEffectWriteBoundaries = (): AuditFinding[] =>
	readFiles("src").flatMap((path) => {
		if (shouldIgnoreSourceFile(path)) return [];
		if (activeEffectWriteBoundaryPaths.has(path)) return [];

		const text = readFileSync(path, "utf8");
		if (!/(?:delete\s+[^;]*\.activeEffects\s*\[|\.activeEffects\s*\[[^\]]+\]\s*=)/.test(text)) {
			return [];
		}

		return [
			{
				path,
				message:
					"active effect writes/removals must go through named Fx boundaries so effect lifecycle changes stay grepable",
			},
		];
	});

const storedInputWriteBoundaryPaths = new Set([
	"src/craft/readOrCreateCraftInputStateFx.ts",
	"src/craft/removeCraftInputStateFromSaveFx.ts",
	"src/craft/writeCraftInputStateToSaveFx.ts",
	"src/producer/pruneEmptyProducerInputStateFx.ts",
	"src/producer/readOrCreateProducerLineInputStateFx.ts",
	"src/producer/removeProducerInputStateFromSaveFx.ts",
]);

export const auditStoredInputWriteBoundaries = (): AuditFinding[] =>
	readFiles("src").flatMap((path) => {
		if (shouldIgnoreSourceFile(path)) return [];
		if (storedInputWriteBoundaryPaths.has(path)) return [];

		const text = readFileSync(path, "utf8");
		if (
			!/(?:delete\s+[^;]*\.(?:producerInputs|craftInputs|lineInputs)\s*\[|\.(?:producerInputs|craftInputs|lineInputs)\s*\[[^\]]+\]\s*(?:\?\?=|=))/.test(
				text,
			)
		) {
			return [];
		}

		return [
			{
				path,
				message:
					"stored input writes/removals must go through named Fx boundaries so producer/craft input lifecycle changes stay grepable",
			},
		];
	});
