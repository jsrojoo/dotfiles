import { sqlCommandExecutes, sqlCommandMutates } from "./classify-sql.ts";

export interface MutativeSqlExecutionDecision {
	block: boolean;
	reason?: string;
}

export function mutativeSqlExecutionEvaluate(
	command: string,
): MutativeSqlExecutionDecision {
	if (!sqlCommandExecutes(command) || !sqlCommandMutates(command)) {
		return { block: false };
	}
	return {
		block: true,
		reason:
			"SQL guardrail: the agent cannot execute mutative SQL or DDL. Prepare exact SQL for user execution after SELECT ... WHERE validation.",
	};
}
