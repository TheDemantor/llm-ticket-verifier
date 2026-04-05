
const structurizeProblem = (problemDesc) => {
    return `You are an expert in application development & support, handling IT support. 
    Your task is to extract a structured representation of the PROBLEM. 
    PROBLEM: 
    --- 
    ${problemDesc} 
    --- 
    1. Rewrite the core problem in one clear sentence. 
    2. List the explicit requirements as bullet points. 
    3. List constraints (time, budget, tech, scope, etc.) if mentioned. 
    5. List acceptance/success criteria (what must be true to call this “done”). 
    6. Analyse and find out the category and subcategory of the problem
    
    Output ONLY valid JSON — no explanations, no markdown, no text.
    Return JSON only with these keys: 
    { 
        "problem_summary": "...", 
        "explicit_requirements": ["...", "..."],
        "constraints": ["...", "..."], 
        "acceptance_criteria": ["...", "..."],
        "category": "...",
        "sub_category: "..."
    }
`;
}


const structurizeSolution = (solutionDesc) => {
    return `You are an expert in application development & support, handling IT support. . 
    Your task is to extract a structured representation of the SOLUTION.

    SOLUTION:
    ---
    ${solutionDesc}
    ---

    1. Rewrite the core solution idea in one clear sentence.
    2. List the main solution components or steps as bullet points.
    3. List assumptions the solution makes about the context, users, or system.
    4. List what outcomes/results the solution claims to achieve.

    Output ONLY valid JSON — no explanations, no markdown, no text.
    Return JSON only with these keys:
    {
    "solution_summary": "...",
    "solution_steps": ["...", "..."],
    "assumptions": ["...", "..."],
    "claimed_outcomes": ["...", "..."]
    }
`;
}


const evaluateSolution = (strProblem, strSolution) => {
    return `You are an expert in application development & support. You are judging IT support ticket solutions.
    You have to compare a structured SOLUTION & a structured PROBLEM.

    PROBLEM (JSON):
    ---
    ${JSON.stringify(strProblem, null, 2)}
    ---

    SOLUTION (JSON):
    ---
    ${JSON.stringify(strSolution, null, 2)}
    ---

    Follow these steps:
    1. For each explicit requirement, state the following:
    - whether it is fully covered, partially covered, or not covered by the solution
    - Which solution steps (if any) relate to it.
    2. Identify any acceptance criteria or constraints that are not clearly satisfied by the solution.
    4. Reason step-by-step and then give:
    - a 0–100 coverage score (how well the solution satisfies the problem)
    - a brief verdict: "sufficient," “partially sufficient," or "insufficient."
    - list of questions: Reasonable questions addressing each violated constraint or unfulfilled acceptance criterion.
    5. Give a reasonable opinion that if this solution can possibly solve the problem (true/false) 

    Output ONLY valid JSON — no explanations, no markdown, no text.
    Return JSON only with these keys:
    {
        "requirement_coverage": [
            {
            "requirement": "...",
            "coverage": "full|partial|none",
            "related_solution_steps": ["...", "..."],
            }
        ],
        "unaddressed_constraints": ["...", "..."],
        "unsatisfied_acceptance_criteria": ["...", "..."],
        "coverage_score": 0,
        "verdict": "sufficient|partially sufficient|insufficient",
        "clarifying_questions": ["...", "..."],
        "possible_solution": true/false 
    }
`;
}


const generateNotes = (questionsArray, answersArray) => {
    return `You are an expert in application development & support, handling IT support.

    You will receive clarifying questions and the answers from user's response. 
    Your task is to summarize the answers into clear, concise notes that can be used to complete the solution details.
    
    Input JSON:
    {
    "clarifying_questions": ${JSON.stringify(questionsArray)},
    "answers": ${JSON.stringify(answersArray)}
    } 

    Output ONLY valid JSON — no explanations, no markdown, no text.

    Steps:
    1. For each question–answer pair(based on index matching):
    - Interpret what new requirement, constraint, detail, or behavior is being clarified.
    - Rewrite it as a single, unambiguous note that can be added directly to the solution.


    Return JSON only with these keys:
    {
    "clarifying_notes": ["...", "..."]
    }
    `;
}


const reEvaluateSolution = (strProblem, strSolution, clarifyingNotes) => {
    return `You are an expert in application development & support. You are judging IT support ticket solutions.
    You have to compare a structured SOLUTION & a structured PROBLEM.

    PROBLEM (JSON):
    ---
    ${JSON.stringify(strProblem, null, 2)}
    ---

    SOLUTION (JSON):
    ---
    ${JSON.stringify(strSolution, null, 2)}
    ---

    CLARIFYING_NOTES (JSON):
    ---
    ${typeof clarifyingNotes === 'string' ? clarifyingNotes : JSON.stringify(clarifyingNotes, null, 2)}
    ---

    Follow these steps:
    1. For each explicit requirement, state the following:
    - whether it is fully covered, partially covered, or not covered by the solution
    - Which solution steps (if any) relate to it.
    2. Identify any acceptance criteria or constraints that are not clearly satisfied by the solution.
    4. Reason step-by-step and then give:
    - a 0–100 coverage score (how well the solution satisfies the problem)
    - a brief verdict: "sufficient," “partially sufficient," or "insufficient."
    - list of questions: Reasonable questions addressing each violated constraint or unfulfilled acceptance criterion.
    5. Give a reasonable opinion that if this solution can possibly solve the problem (true/false) 
    6. Re-evaluate the solution in light of the clarifying notes. Adjust the coverage score, verdict, and questions as needed based on the new information.

    Output ONLY valid JSON — no explanations, no markdown, no text.
    Return JSON only with these keys:
    {
        "requirement_coverage": [
            {
            "requirement": "...",
            "coverage": "full|partial|none",
            "related_solution_steps": ["...", "..."],
            }
        ],
        "unaddressed_constraints": ["...", "..."],
        "unsatisfied_acceptance_criteria": ["...", "..."],
        "coverage_score": 0,
        "verdict": "sufficient|partially sufficient|insufficient",
        "clarifying_questions": ["...", "..."],
        "possible_solution": true/false 
    }
    `;
}


const findRootCause = (strProblem, strSolution, clarifyingNotes) => {
    return `You are an expert in application development & support. You are analyzing IT support ticket solutions.
    
    You are given three JSON objects: 

    strProblem: ${JSON.stringify(strProblem, null, 2)},

    strSolution: ${JSON.stringify(strSolution, null, 2)}, 

    and clarifyingNotes: ${JSON.stringify(clarifyingNotes, null, 2)}.

    Based only on the information in these objects, produce a JSON output with the following three keys:

"understood_root_cause": A concise, one‑sentence explanation of why the issue occurred (as implied by the solution and clarifying notes).

"one_step_check": A single, actionable check (e.g., a command, URL test, file system verification, or log query) that would confirm the same root cause in the future.

"solution_steps": A numbered list of the precise actions taken to resolve the issue, copied or adapted from solution_steps and clarifyingNotes.

Do not add extra commentary, markdown, or explanations. Output only valid JSON.
`;
}


// const findRootCause = (strProblem, strSolution) => {
//     return `You are a Senior IT Support Analyst. Output ONLY valid JSON - no text, no explanations.

//     INPUT:
//     PROBLEM: ${JSON.stringify(strProblem, null, 2)}
//     SOLUTION: ${JSON.stringify(strSolution, null, 2)}

//     TASK: Identify the ROOT CAUSE by tracing from SOLUTION back to PROBLEM.

//     STEPS:
//     1. Symptoms = what's broken (from PROBLEM)
//     2. Fix = what SOLUTION changes 
//     3. Root Cause = fundamental reason symptoms occurred
//     4. Distinguish: Symptom ≠ Root Cause ≠ Contributing Factors
//     5. Return two fields:
//        - "cause": 1-sentence diagnostic check for this root cause
//        - "root_cause_summary": brief root cause explanation (2-3 sentences)

//     Output ONLY valid JSON — no explanations, no markdown, no text.
//     Return JSON only with these keys:
//     {
//     "cause": "...",
//     "root_cause_summary": "..."
//     }
// `;
// }


const summarizeSolution = (strSolution) => {
    return `You are a senior IT support analyst specializing in solution summarization.
    
    Your task is to generate a concise SUMMARY of the SOLUTION provided.
    SOLUTION (JSON):
    ---
    ${strSolution}
    ---
    Return JSON only with these keys:
    {
        "solution_summary": "A clear, concise summary of the solution steps",
        "claimed_outcome": "A clear, concise summary of the expected outcomes"
    }
`;}

export default {
    structurizeProblem,
    structurizeSolution,
    evaluateSolution,
    generateNotes,
    reEvaluateSolution,
    // updateSolution,
    findRootCause,
    summarizeSolution
}

