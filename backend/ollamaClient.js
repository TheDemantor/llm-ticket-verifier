// Import Ollama JavaScript SDK for interacting with local Ollama API
import { Ollama } from "ollama";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get Ollama API URL from environment or use default localhost
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";
// Model to use for all LLM operations
const MODEL_NAME = "llama3.2";

// Initialize Ollama client with the API URL
const ollama = new Ollama({
  host: OLLAMA_API_URL
});
     
/**
 * Initializes and verifies connection to Ollama API
 * Tests connection by listing available models
 * @returns {Promise<{connected: boolean}>} Connection status
 */
export async function initializeOllama() {
  try {
    // Try to list models - if this succeeds, Ollama is running
    await ollama.list();
    return { connected: true };
  } catch (error) {
    // Connection failed
    return { connected: false };
  }
}

/**
 * Analyzes a problem description using LLM with context from similar problems
 * Uses similar problems internally for context but returns only a simple question
 * @param {string} problem_description - The problem description
 * @param {Array<Object>} similar_problems_array - Array of similar problem objects from database
 * @returns {Promise<{ai_response: string}>} Object with ai_response field
 */
export async function analyzeProblem(problem_description, similar_problems_array) {
  try {
    // Build prompt that includes similar problems for LLM context
    // The LLM uses this to understand the problem better internally
    // but is instructed to only return a simple question to the user
    const prompt = `You are an IT support solution validator.

Context (for your understanding only, DO NOT mention to user):

Found ${similar_problems_array.length} similar past problems:

${JSON.stringify(similar_problems_array)}

User problem: "${problem_description}"

Your job: Understand the problem + past solutions so you can later judge if user's solution matches.

For now, respond ONLY with this exact text:

"I do understand the problem. How did you solve this?"`;

    // Call Ollama API to generate response
    const response = await ollama.generate({
      model: MODEL_NAME,
      prompt: prompt
    });

    // Always return the exact expected response regardless of LLM output
    // This ensures consistent user experience
    return { ai_response: response.response };
  } catch (error) {
    // Fallback to exact response even on error
    // Ensures user always gets a response even if Ollama fails
    return { message: "Error: Failed to analyze problem." };
  }
}

/**
 * Analyzes a user-provided solution using LLM
 * Provides detailed analysis of technical accuracy, completeness, and quality
 * @param {string} solution_text - The solution text to analyze
 * @returns {Promise<string>} LLM analysis of the solution
 */
export async function analyzeUserSolution(solution_text) {
  try {
    // Create detailed prompt for comprehensive solution analysis
    const prompt = `You are a technical IT support expert reviewing a solution provided by a user.

Analyze the following solution in detail:
${solution_text}

Provide a comprehensive analysis covering:
1. Technical accuracy
2. Completeness
3. Clarity and structure
4. Potential gaps or missing steps
5. Overall quality assessment

Return your analysis as a detailed text response.`;

    // Generate analysis using Ollama
    const response = await ollama.generate({
      model: MODEL_NAME,
      prompt: prompt
    });

    // Extract response text - handle different response structures from Ollama API
    // Different versions may return response in different formats
    return response.response || response.message?.content || String(response);
  } catch (error) {
    // Throw error to be handled by caller
    throw new Error(`Failed to analyze solution: ${error.message}`);
  }
}

/**
 * Generates exactly 3 follow-up questions based on current solution and problem description
 * @param {string} currentSolution - The current solution text
 * @param {string} problemDescription - The problem description
 * @returns {Promise<{questions: [string, string, string]}>} Object with exactly 3 questions
 */
export async function generateFollowUpQuestions(currentSolution, problemDescription) {
  try {
    const prompt = `You are a technical IT support expert generating follow-up questions to improve solution quality.

Problem Description:
${problemDescription}

Current Solution:
${currentSolution}

Generate exactly 3 follow-up questions that would help clarify, specify, or improve the implementation of this solution. The questions should be:
1. One clarification question
2. One specificity question  
3. One implementation question

Return ONLY a valid JSON object in this exact format:
{
  "questions": ["question 1", "question 2", "question 3"]
}

Do not include any additional text, explanations, or markdown formatting. Only return the JSON object.`;

    const response = await ollama.generate({
      model: MODEL_NAME,
      prompt: prompt,
      format: "json"
    });

    // Extract response text - handle different response structures
    const responseText = response.response || response.message?.content || String(response);
    const parsed = JSON.parse(responseText);
    
    // Ensure exactly 3 questions
    if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length === 3) {
      return { questions: parsed.questions };
    } else {
      // Fallback: generate 3 default questions if parsing fails
      return {
        questions: [
          "Can you provide more details about the root cause?",
          "What specific steps should be followed to implement this solution?",
          "Are there any prerequisites or dependencies needed?"
        ]
      };
    }
  } catch (error) {
    // Return default questions on error
    return {
      questions: [
        "Can you provide more details about the root cause?",
        "What specific steps should be followed to implement this solution?",
        "Are there any prerequisites or dependencies needed?"
      ]
    };
  }
}

/**
 * Validates a new solution against old solutions to check for matches
 * @param {string} newSolution - The new solution text
 * @param {Array<string>} oldSolutions_array - Array of old solution texts
 * @returns {Promise<{matches: boolean, matchPercentage: number, explanation: string}>}
 */
export async function validateSolutionAgainstOld(newSolution, oldSolutions_array) {
  try {
    const oldSolutionsText = oldSolutions_array.join("\n\n---\n\n");

    const prompt = `You are a technical IT support expert.

Compare this NEW solution:
${newSolution}

Against these OLD solutions:
${oldSolutionsText}

Analyze if the new solution matches or is similar to any of the old solutions. Consider:
- Technical approach similarity
- Solution steps overlap
- Root cause analysis similarity
- Overall solution structure

Return JSON with this exact structure:
{
  "matches": true or false,
  "matchPercentage": number between 0 and 100,
  "explanation": "detailed explanation of the comparison"
}

Return ONLY the JSON object. Do not include any additional text, markdown, or formatting.`;

    const response = await ollama.generate({
      model: MODEL_NAME,
      prompt: prompt,
      format: "json"
    });

    // Extract response text - handle different response structures
    const responseText = response.response || response.message?.content || String(response);
    const parsed = JSON.parse(responseText);
    
    // Validate and normalize the response
    return {
      matches: Boolean(parsed.matches),
      matchPercentage: Math.max(0, Math.min(100, Number(parsed.matchPercentage) || 0)),
      explanation: String(parsed.explanation || "No explanation provided")
    };
  } catch (error) {
    return {
      matches: false,
      matchPercentage: 0,
      explanation: `Error during validation: ${error.message}`
    };
  }
}

/**
 * Formats solution structure based on problem description, root cause analysis, and solution details
 * @param {string} problemDesc - Problem description
 * @param {string} rootCauseAnalysis - Root cause analysis
 * @param {string} solutionDetails - Solution details
 * @returns {Promise<string>} Formatted solution string
 */
export async function formatSolutionStructure(problemDesc, rootCauseAnalysis, solutionDetails) {
  try {
    const prompt = `You are a technical IT support expert formatting a solution document.

Problem Description:
${problemDesc}

Root Cause Analysis:
${rootCauseAnalysis}

Solution Details:
${solutionDetails}

Format these components into a well-structured, professional solution document. The format should include:
1. A clear problem statement section
2. A detailed root cause analysis section
3. A step-by-step solution implementation section
4. Proper headings and organization
5. Clear, technical language appropriate for IT support documentation

Return the formatted solution as a single, well-structured text document. Do not include JSON or code blocks, just the formatted solution text.`;

    const response = await ollama.generate({
      model: MODEL_NAME,
      prompt: prompt
    });

    // Extract response text - handle different response structures
    return response.response || response.message?.content || String(response);
  } catch (error) {
    throw new Error(`Failed to format solution structure: ${error.message}`);
  }
}

