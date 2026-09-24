const SQL_EXECUTION_PATTERN = /(?:\bpsql\b|\bsqlcmd\b|\bmysql\b|\bsqlite3\b|\bpython(?:3)?\b|\bpoetry\s+run\s+python\b|\bexecute\s*\(|\.execute\s*\(|\balembic\s+(?:upgrade|downgrade)\b)/i;
const SQL_MUTATION_PATTERN = /\b(?:insert\s+into|update\s+\w+(?:\.\w+)*(?:\s+(?:as\s+)?\w+)?\s+set|delete\s+from|merge\s+into|alter\s+(?:table|schema|database)|create\s+(?:table|schema|database|index)|drop\s+(?:table|schema|database|index)|truncate\s+(?:table\s+)?\w+|alembic\s+(?:upgrade|downgrade))\b/i;
const SQL_PROOF_PATTERN = /\bselect\b[\s\S]*\bwhere\b/i;
const SQL_TEXT_PATTERN = /\b(?:select\b[\s\S]*\bfrom\b|insert\s+into|update\s+\w+(?:\.\w+)*(?:\s+(?:as\s+)?\w+)?\s+set|delete\s+from|merge\s+into|alter\s+(?:table|schema)|create\s+(?:table|schema)|drop\s+(?:table|schema)|truncate\s+)/i;
const SQL_LINE_PATTERN = /^[ \t]*(?:select\s+[\w.*",()]+\s+from\s+[\w."-]+|insert\s+into|update\s+\w+(?:\.\w+)*(?:\s+(?:as\s+)?\w+)?\s+set|delete\s+from|merge\s+into|alter\s+(?:table|schema)|create\s+(?:table|schema)|drop\s+(?:table|schema)|truncate\s+)/im;
const SQL_FENCE_PATTERN = /```sql[^\S\r\n]*\r?\n([\s\S]*?)```/gi;

export function sqlCommandExecutes(command: string): boolean {
	if (!SQL_EXECUTION_PATTERN.test(command)) return false;
	return !/^\s*(?:grep|rg|find|cat|echo|printf|head|tail)\b/i.test(command);
}

export function sqlCommandMutates(command: string): boolean {
	return SQL_MUTATION_PATTERN.test(command);
}

export function sqlCommandProvidesProof(command: string): boolean {
	return SQL_PROOF_PATTERN.test(command);
}

export function sqlTextNeedsProof(text: string): boolean {
	if (SQL_LINE_PATTERN.test(text)) return true;
	return Array.from(text.matchAll(SQL_FENCE_PATTERN)).some((match) =>
		SQL_TEXT_PATTERN.test(match[1]),
	);
}
