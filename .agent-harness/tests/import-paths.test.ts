import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const DEEP_RELATIVE_IMPORT = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["']((?:\.\.\/){2,}[^"']*)["']/g;
const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SOURCE_ROOTS = [
	path.join(REPOSITORY_ROOT, ".agent-harness", "src"),
	path.join(REPOSITORY_ROOT, ".agent-harness", "tests"),
	path.join(REPOSITORY_ROOT, ".pi", "agent", "extensions"),
];

function typescriptFilesFind(directory: string): string[] {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return typescriptFilesFind(entryPath);
		return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
	});
}

test("TypeScript imports use aliases instead of deep parent paths", () => {
	const violations = SOURCE_ROOTS.flatMap(typescriptFilesFind).flatMap((filePath) => {
		const source = fs.readFileSync(filePath, "utf8");
		return Array.from(source.matchAll(DEEP_RELATIVE_IMPORT), (match) =>
			`${path.relative(REPOSITORY_ROOT, filePath)}: ${match[1]}`,
		);
	});

	assert.deepEqual(violations, []);
});
