// Import OpenAI SDK for interacting with DeepSeek API
import OpenAI from "openai";
import dotenv from "dotenv";
import prompts from "./prompts.js";

// Load environment variables
dotenv.config();

// Get DeepSeek API key from environment
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// Model to use for all LLM operations
const MODEL_NAME = "deepseek-chat";

// Initialize DeepSeek client with OpenAI SDK
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: DEEPSEEK_API_KEY
});

/**
 * Initializes and verifies connection to DeepSeek API
 * Tests connection by sending a simple test message
 * @returns {Promise<{connected: boolean}>} Connection status
 */
export async function initializeDeepSeek() {
  try {
    // Try to send a simple message - if this succeeds, DeepSeek is running
    await openai.chat.completions.create({
      messages: [{ role: "user", content: "test" }],
      model: MODEL_NAME,
      max_tokens: 10
    });
    return { connected: true };
  } catch (error) {
    // Connection failed
    console.error("DeepSeek connection error:", error.message);
    return { connected: false };
  }
}

// // /**
// //  * Analyzes a problem description using LLM with context from similar problems
// //  * Uses similar problems internally for context but returns only a simple question
// //  * @param {string} problem_description - The problem description
// //  * @param {Array<Object>} similar_problems_array - Array of similar problem objects from database
// //  * @returns {Promise<{ai_response: string}>} Object with ai_response field
// //  */
// export async function analyzeProblem(problem_description, similar_problems_array) {
//   try {
//     // Build prompt that includes similar problems for LLM context
//     // The LLM uses this to understand the problem better internally
//     // but is instructed to only return a simple question to the user
//     const prompt = `You are an IT support solution validator.

// Context (for your understanding only, DO NOT mention to user):

// Found ${similar_problems_array.length} similar past problems:

// ${JSON.stringify(similar_problems_array)}

// User problem: "${problem_description}"

// Your job: Understand the problem + past solutions so you can later judge if user's solution matches.

// For now, respond ONLY with this exact text:

// "I do understand the problem. How did you solve this?"`;

//     // Call DeepSeek API to generate response
//     const response = await openai.chat.completions.create({
//       messages: [{ role: "user", content: prompt }],
//       model: MODEL_NAME
//     });

//     // Always return the exact expected response regardless of LLM output
//     // This ensures consistent user experience
//     return { ai_response: response.choices[0].message.content };
//   } catch (error) {
//     // Fallback to exact response even on error
//     // Ensures user always gets a response even if DeepSeek fails
//     return { message: "Error: Failed to analyze problem." };
//   }
// }

/**
 * Structures a problem description into a standardized format
 * Parses and organizes problem information for consistent processing
 * @param {string} problemDesc - Problem description
 * @returns {Promise<Object>} Structured problem object with organized components
 */
export async function structurizeProbem(problemDesc){
  try {
    const prompt = prompts.structurizeProblem(problemDesc);

    const response = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: MODEL_NAME
    });
    
    return response.choices[0].message.content || String(response);
  } catch (error) {
    throw new Error(`Failed to structurize problem: ${error.message}`);
  }
}

/**
 * Structures a solution into a standardized format
 * Parses and organizes solution information for consistent processing
 * @param {string} solutionDesc - Solution description
 * @returns {Promise<Object>} Structured solution object with organized components
 */
export async function structurizeSolution(solutionDesc){
    try {
    const prompt = prompts.structurizeSolution(solutionDesc);

    const response = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: MODEL_NAME
    });

    return response.choices[0].message.content || String(response);
  } catch (error) {
    throw new Error(`Failed to structurize solution: ${error.message}`);
  }
}

/**
 * Evaluates a solution based on the problem description
 * Provides quality assessment covering coverage, gaps, and clarifying questions
 * @param {string} strProblem - Structured problem description
 * @param {string} strSolution - Structured solution description
 * @returns {Promise<Object>} Evaluation result with quality metrics and feedback
 */
export async function evaluateSolution(strProblem, strSolution){
    try {
    const prompt = prompts.evaluateSolution(strProblem, strSolution);
    
    const response = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: MODEL_NAME
    });

    return response.choices[0].message.content || String(response);
  } catch (error) {
    throw new Error(`Failed to evaluate solution: ${error.message}`);
  }
}

/**
 * Generates summary notes from questions and their answers
 * Consolidates clarifying information into actionable notes
 * @param {Array<string>} questionsArray - Array of follow-up questions
 * @param {Array<string>} answersArray - Array of corresponding answers
 * @returns {Promise<string>} Generated summary notes
 */
export async function generateNotes(questionsArray, answersArray){
    try {
    const prompt = prompts.generateNotes(questionsArray, answersArray);

    const response = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: MODEL_NAME
    });

    return response.choices[0].message.content || String(response);
  } catch (error) {
    throw new Error(`Failed to generate notes: ${error.message}`);
  }
}

/**
 * Re-evaluates a solution with additional clarifying notes
 * Provides updated assessment after receiving clarification responses
 * @param {string} strProblem - Structured problem description
 * @param {string} strSolution - Structured solution description
 * @param {string} clarifyingNotes - Additional clarifying notes from user
 * @returns {Promise<Object>} Updated evaluation with improved recommendations
 */
export async function reEvaluateSolution(strProblem, strSolution, clarifyingNotes){
  try {
    strSolution.clarifying_notes = clarifyingNotes;
    const prompt = prompts.reEvaluateSolution(strProblem, strSolution, clarifyingNotes);

    const response = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: MODEL_NAME
    });

    return response.choices[0].message.content || String(response);
  } catch (error) {
    throw new Error(`Failed to re-evaluate solution: ${error.message}`);
  }
}

// /**
//  * Updates solution with clarifying notes incorporated
//  * Enhances the solution structure with additional context
//  * @param {string} strProblem - Structured problem description
//  * @param {string} strSolution - Structured solution description
//  * @param {string} clarifyingNotes - Clarifying notes to incorporate
//  * @returns {Promise<string>} Enhanced solution with integrated notes
//  */
// export async function updateSolution(strSolution, clarifyingNotes){
//   try {
//     const prompt = prompts.updateSolution(strSolution, clarifyingNotes);

//     const response = await openai.chat.completions.create({
//       messages: [{ role: "user", content: prompt }],
//       model: MODEL_NAME
//     });

//     return response.choices[0].message.content || String(response);
//   } catch (error) {
//     throw new Error(`Failed to update solution: ${error.message}`);
//   }
// }

/**
 * Identifies and analyzes the root cause from problem and solution
 * Extracts underlying cause information from the solution context
 * @param {string} strProblem - Structured problem description
 * @param {string} strSolution - Structured solution description
 * @returns {Promise<Object>} Root cause with explanation
 */
export async function findRootCause(strProblem, strSolution, evaluationReport){
  try {
    const prompt = prompts.findRootCause(strProblem, strSolution, evaluationReport);

    const response = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: MODEL_NAME
    });
    
    const responseContent = response.choices[0].message.content || String(response);
    return responseContent;
  } catch (error) {
    throw new Error(`Failed to find root cause: ${error.message}`);
  }
}

// // /**
// //  * Generates follow-up questions based on conversation context
// //  * @param {string} conversationContext - Context from the conversation
// //  * @param {string} problemDesc - Problem description
// //  * @returns {Promise<{questions: Array<string>}>} Generated questions
// //  */
// export async function generateFollowUpQuestions(conversationContext, problemDesc) {
//   try {
//     const prompt = `Based on this conversation:\n${conversationContext}\n\nAnd problem:\n${problemDesc}\n\nGenerate clarifying questions.`;
//     
//     const response = await openai.chat.completions.create({
//       messages: [{ role: "user", content: prompt }],
//       model: MODEL_NAME
//     });
//     
//     return { questions: [response.choices[0].message.content] };
//   } catch (error) {
//     throw new Error(`Failed to generate follow-up questions: ${error.message}`);
//   }
// }

// // /**
// //  * Validates a solution against existing old solutions
// //  * @param {string} newSolution - New solution to validate
// //  * @param {Array<string>} oldSolutions - Array of existing solutions
// //  * @returns {Promise<{matches: boolean, matchPercentage: number}>} Validation result
// //  */
// export async function validateSolutionAgainstOld(newSolution, oldSolutions) {
//   try {
//     const prompt = `Compare this new solution:\n${newSolution}\n\nAgainst these existing solutions:\n${oldSolutions.join('\n---\n')}\n\nReturn JSON with matches (boolean) and matchPercentage (0-100).`;
//     
//     const response = await openai.chat.completions.create({
//       messages: [{ role: "user", content: prompt }],
//       model: MODEL_NAME
//     });
//     
//     const result = JSON.parse(response.choices[0].message.content);
//     return result;
//   } catch (error) {
//     throw new Error(`Failed to validate solution: ${error.message}`);
//   }
// }
