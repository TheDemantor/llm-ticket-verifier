
const structurizeProblem = (problemDesc) => {
    return `You are a senior analyst. 
    Your task is to extract a structured representation of the PROBLEM. 
    PROBLEM: 
    --- 
    ${problemDesc} 
    --- 
    1. Rewrite the core problem in one clear sentence. 
    2. List the explicit requirements as bullet points. 
    3. List any implicit requirements you can reasonably infer. 
    4. List constraints (time, budget, tech, scope, etc.) if present. 
    5. List acceptance/success criteria (what must be true to call this “done”). 
    
    Return JSON only with these keys: 
    { 
        "problem_summary": "...", 
        "explicit_requirements": ["...", "..."], 
        "implicit_requirements": ["...", "..."], 
        "constraints": ["...", "..."], 
        "acceptance_criteria": ["...", "..."] 
    }`;
}


const structurizeSolution = (solutionDesc) => {
    return `You are a senior solution architect. 
    Your task is to extract a structured representation of the SOLUTION.

    SOLUTION:
    ---
    ${solutionDesc}
    ---

    1. Rewrite the core solution idea in one clear sentence.
    2. List the main solution components or steps as bullet points.
    3. List assumptions the solution makes about the context, users, or system.
    4. List what outcomes/results the solution claims to achieve.

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
    return `You are an expert reviewer. 
    You will compare a structured PROBLEM and a structured SOLUTION.

    PROBLEM (JSON):
    ---
    ${strProblem}
    ---

    SOLUTION (JSON):
    ---
    ${strSolution}
    ---

    Follow these steps:
    1. For each explicit and implicit requirement, state:
    - whether it is fully covered, partially covered, or not covered by the solution
    - which solution_steps (if any) relate to it.
    2. Identify any constraints that are not respected or not addressed.
    3. Identify any acceptance_criteria that are not clearly satisfied by the solution.
    4. Identify any extra features in the solution that are not requested by the problem.
    5. Reason step-by-step and then give:
    - a 0–100 coverage score (how well the solution satisfies the problem)
    - a brief verdict: “sufficient”, “partially sufficient”, or “insufficient”.
    - a concise list: “Missing or weak points the solution should add or clarify”.
    6. based on "Missing or weak points the solution should add or clarify", prepare n  number of questions for the user to ask for clarifying these points. 

    Return JSON only with these keys:
    {
    "requirement_coverage": [
        {
        "requirement": "...",
        "type": "explicit|implicit",
        "coverage": "full|partial|none",
        "related_solution_steps": ["...", "..."],
        "notes": "..."
        }
    ],
    "unaddressed_constraints": ["...", "..."],
    "unsatisfied_acceptance_criteria": ["...", "..."],
    "extra_solution_features": ["...", "..."],
    "coverage_score": 0,
    "verdict": "sufficient|partially sufficient|insufficient",
    "missing_or_weak_points": ["...", "..."],
    "clarifying_questions": ["...", "..."]
    }
`;
}


const generateNotes = (questionsArray, answersArray) => {
    return `You are a senior analyst.

    You will receive clarifying questions and the user's answers. 
    Your task is to synthesize them into clear, concise notes that can be used to improve the solution.

    Input JSON:
    {
    "clarifying_questions": ${JSON.stringify(questionsArray)},
    "answers": ${JSON.stringify(answersArray)}
    } 

    Steps:
    1. For each question–answer pair(based on index matching):
    - Interpret what new requirement, constraint, detail, or behavior is being clarified.
    - Rewrite it as a single, unambiguous note that can be applied directly to the solution.
    2. Keep the notes:
    - Concrete and implementation-ready.
    - Free of meta-talk about questions or the conversation.

    Return JSON only with this shape:
    {
    "clarifying_notes": ["...", "..."]
    }
    `;
}


const reEvaluateSolution = (strProblem, strSolution) => {
    return `You are an expert reviewer. 
    You will compare a structured PROBLEM and a structured SOLUTION.

    PROBLEM (JSON):
    ---
    ${strProblem}
    ---

    SOLUTION (JSON):
    ---
    ${strSolution}
    ---

    Follow these steps:
    1. For each explicit and implicit requirement, state:
    - whether it is fully covered, partially covered, or not covered by the solution
    - which solution_steps (if any) relate to it.
    2. Identify any constraints that are not respected or not addressed.
    3. Identify any acceptance_criteria that are not clearly satisfied by the solution.
    4. Identify any extra features in the solution that are not requested by the problem.
    5. Reason step-by-step and then give:
    - a 0–100 coverage score (how well the solution satisfies the problem)
    - a brief verdict: “sufficient”, “partially sufficient”, or “insufficient”.
    - a concise list: “Missing or weak points the solution should add or clarify”.
    6. find the answers to these “Missing or weak points the solution should add or clarify” in the "clarifying_notes" if they are provided
    7. based on remaining "Missing or weak points the solution should add or clarify", prepare n number of questions for the user to ask for clarifying these points. 


    Return JSON only with these keys:
    {
    "requirement_coverage": [
        {
        "requirement": "...",
        "type": "explicit|implicit",
        "coverage": "full|partial|none",
        "related_solution_steps": ["...", "..."],
        "notes": "..."
        }
    ],
    "unaddressed_constraints": ["...", "..."],
    "unsatisfied_acceptance_criteria": ["...", "..."],
    "extra_solution_features": ["...", "..."],
    "coverage_score": 0,
    "verdict": "sufficient|partially sufficient|insufficient",
    "missing_or_weak_points": ["...", "..."],
    "clarifying_questions": ["...", "..."]
    }
    `;
}


const updateSolution = (strProblem, strSolution, clarifyingNotes) => {
    return `You are an experienced Senior Analyst.
    You will be given three structured JSON inputs:

    PROBLEM: ${strProblem}

    SOLUTION: ${strSolution}

    CLARIFYING_NOTES: ${clarifyingNotes}

    Your task:

    Examine each clarifying note to determine whether it impacts any part of the solution_steps or claimed_outcomes in the SOLUTION.

    If a note requires changes, update the SOLUTION accordingly. Adjust only what is necessary.

    Output the revised SOLUTION strictly in JSON format, using the following structure:

    json
    {
    "solution_summary": "...",
    "solution_steps": ["...", "..."],
    "assumptions": ["...", "..."],
    "claimed_outcomes": ["...", "..."]
    }`
}


const findRootCause = (strProblem, strSolution) => {
    return `You are a senior IT support analyst specializing in root cause analysis.
    
    Your task is to identify and document the ROOT CAUSE of the problem based on the problem description and the solution provided.

    PROBLEM (JSON):
    ---
    ${strProblem}
    ---

    SOLUTION (JSON):
    ---
    ${strSolution}
    ---

    Follow these steps:
    1. Analyze the problem statement and identify the symptoms (what is broken/not working).
    2. Examine the solution to understand what actions are being taken to fix the issue.
    3. Trace back from the solution to identify the underlying ROOT CAUSE - the fundamental reason why the problem occurred.
    4. Distinguish between:
       - Symptom: The visible problem the user experiences
       - Root Cause: The underlying reason it happened
       - Contributing Factors: Other factors that contributed to the issue
    5. Assess the likelihood and impact of this root cause.
    6. Identify if there are multiple root causes or if this is a single issue with cascading effects.

    Return JSON only with these keys:
    {
        "cause": "...",
        "root_cause_summary": "A clear, concise explanation of the primary root cause"
    }`;
}


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
`


export default {
    structurizeProblem,
    structurizeSolution,
    evaluateSolution,
    generateNotes,
    reEvaluateSolution,
    updateSolution,
    findRootCause
}

