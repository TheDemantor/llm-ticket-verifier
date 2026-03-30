
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
    You will compare a structured PROBLEM and a structured SOLUTION.

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
    2. Identify any constraints that are not respected or not addressed.
    3. Identify any acceptance criteria that are not clearly satisfied by the solution.
    4. Reason step-by-step and then give:
    - a 0–100 coverage score (how well the solution satisfies the problem)
    - a brief verdict: “sufficient”, “partially sufficient”, or “insufficient”.
    - a concise list: “Missing or weak points the solution should add or clarify” based on violated constraints or unfulfilled acceptance criteria.
    6. Based on "missing or weak points the solution should add or clarify," prepare n number of questions for the user to clarify these points. 
    7. Give a reasonable opinion that if this solution can possibly solve the problem (true/false) 

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
        "missing_or_weak_points": ["...", "..."],
        "clarifying_questions": ["...", "..."],
        "possible_solution": true/false (give reasoning)
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
    INPUT (JSON) :
    ---
    ${JSON.stringify({
        "clarifying_questions": questionsArray,
        "answers": answersArray
    }, null, 2)}
    ---

    Output ONLY valid JSON — no explanations, no markdown, no text.

    Steps:
    1. For each question–answer pair(based on index matching):
    - Interpret what new requirement, constraint, detail, or behavior is being clarified.
    - Rewrite it as a single, unambiguous note that can be applied directly to the solution.
    2. Keep the notes:
    - Concrete and implementation-ready.
    - Free of meta-talk about questions or the conversation.

    Return JSON only with these keys:
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
    ${JSON.stringify(strProblem, null, 2)}
    ---

    SOLUTION (JSON):
    ---
    ${JSON.stringify(strSolution, null, 2)}
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

    Output ONLY valid JSON — no explanations, no markdown, no text.
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

    PROBLEM: ${JSON.stringify(strProblem, null, 2)}

    SOLUTION: ${JSON.stringify(strSolution, null, 2)}

    CLARIFYING_NOTES: ${typeof clarifyingNotes === 'string' ? clarifyingNotes : JSON.stringify(clarifyingNotes, null, 2)}

    Your task:

    Examine each clarifying note to determine whether it impacts any part of the solution_steps or claimed_outcomes in the SOLUTION.

    If a note requires changes, update the SOLUTION accordingly. Adjust only what is necessary.
    
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


const findRootCause = (strProblem, strSolution) => {
    return `You are a Senior IT Support Analyst. Output ONLY valid JSON - no text, no explanations.

    INPUT:
    PROBLEM: ${JSON.stringify(strProblem, null, 2)}
    SOLUTION: ${JSON.stringify(strSolution, null, 2)}

    TASK: Identify the ROOT CAUSE by tracing from SOLUTION back to PROBLEM.

    STEPS:
    1. Symptoms = what's broken (from PROBLEM)
    2. Fix = what SOLUTION changes 
    3. Root Cause = fundamental reason symptoms occurred
    4. Distinguish: Symptom ≠ Root Cause ≠ Contributing Factors
    5. Return two fields:
       - "cause": 1-sentence diagnostic check for this root cause
       - "root_cause_summary": brief root cause explanation (2-3 sentences)

    Output ONLY valid JSON — no explanations, no markdown, no text.
    Return JSON only with these keys:
    {
    "cause": "...",
    "root_cause_summary": "..."
    }
`;
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
`;}

export default {
    structurizeProblem,
    structurizeSolution,
    evaluateSolution,
    generateNotes,
    reEvaluateSolution,
    updateSolution,
    findRootCause,
    summarizeSolution
}

