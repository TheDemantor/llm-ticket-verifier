// Import Express and middleware for creating the API server
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

// Import database functions for MongoDB operations
import {
  getDB,
  insertProblem,
  insertSolution,
  createChatSession,
  getChatSession,
  addChatMessage,
  updateProblemWithRootCause,
  updateChatSessionStatus
} from "../database/db.js";

// Import Mongoose for session updates
import mongoose from "mongoose";
import { chatSessionSchema, problemSchema } from "../models/schemas.js";

// Create ChatSession model for direct database updates
const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
const Problem = mongoose.model("Problem", problemSchema);

// Import Ollama client functions for AI operations
import {
  structurizeProbem,
  structurizeSolution,
  evaluateSolution,
  generateNotes,
  reEvaluateSolution,
  updateSolution,
  findRootCause
} from "./ollamaClient.js";

// Load environment variables from .env file
dotenv.config();

// Initialize Express application
const app = express();
// Set port from environment or default to 3000
const PORT = process.env.PORT || 3000;

// Configure CORS to allow requests from Streamlit (running on port 8501)
app.use(cors({
  origin: "http://localhost:8501",
  credentials: true
}));

// Parse JSON request bodies
app.use(bodyParser.json());
// Parse URL-encoded request bodies
app.use(bodyParser.urlencoded({ extended: true }));


/**
 * Centralized error handler middleware
 * Formats and sends error responses with consistent structure
 * @param {Object} res - Express response object
 * @param {Error} error - Error object
 * @param {string} code - Error code for client-side handling
 */
const handleError = (res, error, code = "INTERNAL_ERROR") => {
  console.error("Error:", error);
  // Return standardized error response
  res.status(500).json({
    error: error.message || "An internal error occurred",
    code: code
  });
};

/**
 * Parses Ollama response string that contains JSON in markdown format
 * Extracts JSON from format like: "text...\n```\n{...}\n```"
 * @param {string} ollamaResponse - Raw response string from Ollama
 * @returns {Object} Parsed JSON object, or original response if parsing fails
 */
const parseOllamaResponse = (ollamaResponse) => {
  try {
    // Check if response is already an object
    if (typeof ollamaResponse === 'object') {
      return ollamaResponse;
    }

    // Convert to string if needed
    const responseStr = String(ollamaResponse);

    // Try to extract JSON from markdown code block format
    // Pattern: ```json\n{...}\n``` or ```\n{...}\n```
    const jsonMatch = responseStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    
    if (jsonMatch && jsonMatch[1]) {
      // Parse the extracted JSON
      const parsedJson = JSON.parse(jsonMatch[1].trim());
      console.log("Successfully parsed Ollama JSON response");
      return parsedJson;
    }

    // If no markdown format found, try to parse the whole response as JSON
    const directParse = JSON.parse(responseStr);
    console.log("Successfully parsed Ollama response as direct JSON");
    return directParse;
  } catch (error) {
    console.warn("Could not parse Ollama response as JSON:", error.message);
    console.log("Returning raw response:", ollamaResponse);
    // Return the original response if parsing fails
    return ollamaResponse;
  }
};


/**
 * POST /api/chat/start
 * Body: { user_id, problem_description }
 * Returns: { session_id, ai_response }
 */
app.post("/api/chat/start", async (req, res) => {
  try {
    // console.log("POST /api/chat/start - Input:", JSON.stringify(req.body, null, 2));
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        error: "user_id is required",
        code: "MISSING_FIELDS"
      });
    }

    // Initialize database connection
    await getDB();

    // Generate session_id (uuid)
    const session_id = uuidv4();

    // Save session to DB with status "waiting_solution"
    const sessionResult = await createChatSession({
      session_id: session_id,
      user_id: user_id,
      status: "active"
    });

    if (!sessionResult.success) {
      return handleError(res, new Error(sessionResult.error), "SESSION_CREATE_ERROR");
    }
    
    console.log("Session created:", session_id);

    res.json({
      session_id: session_id,
    });
  } catch (error) {
    handleError(res, error, "CHAT_START_ERROR");
  }
});

/**
 * POST /api/chat/message
 * Body: { session_id, user_message, message_type (user_solution/response) }
 * Returns: { response, next_action (validate/ask_followup/save_solution) }
 */
app.post("/api/chat/message", async (req, res) => {
  try {
    // console.log("POST /api/chat/message - Input:", JSON.stringify(req.body, null, 2));
    const { session_id, content, message_type } = req.body;

    // Validate all required fields are present
    if (!session_id || !content || !message_type) {
      return res.status(400).json({
        error: "session_id, content, and message_type are required",
        code: "MISSING_FIELDS"
      });
    }

    // Validate message_type is one of the allowed values
    if (!["user_solution", "bot", "response"].includes(message_type)) {
      return res.status(400).json({
        error: "message_type must be 'user_solution' or 'response' or 'bot'",
        code: "INVALID_MESSAGE_TYPE"
      });
    }

    // Save user's message to chat history in database
    await addChatMessage({
      session_id: session_id,
      role: message_type === "bot" ? "assistant" : "user",
      message_type: message_type,
      content: content
    });

    res.status(200).json({
      next_action: "continue"
    });
  } catch (error) {
    handleError(res, error, "CHAT_MESSAGE_ERROR");
  }
});


/**
 * POST /api/structure/problem
 * Body: { problemDesc }
 * Returns: { problem_id, structured_problem }
 */
app.post("/api/structure/problem", async (req, res) => {
  try {
    // console.log("POST /api/structure/problem - Input:", JSON.stringify(req.body, null, 2));
    const { problemDesc } = req.body;

    if (!problemDesc) {
      return res.status(400).json({
        error: "problemDesc is required",
        code: "MISSING_FIELDS"
      });
    }

    // Initialize database connection
    await getDB();

    // Step 1: Call structurizeProbem first to structure the problem and extract explicit requirements
    console.log("Step 1: Structurizing problem...");
    const structuredProblemRaw = await structurizeProbem(problemDesc);
    // console.log("Raw Ollama response:", structuredProblemRaw);
    
    const structuredProblem = parseOllamaResponse(structuredProblemRaw);
    // console.log("Parsed structured problem:", JSON.stringify(structuredProblem, null, 2));

    // Step 2: Save problem to database according to schema with explicit_requirements
    console.log("Step 2: Saving problem to database...");
    
    // Ensure explicit_requirements is an array
    const requirements = Array.isArray(structuredProblem.explicit_requirements) 
      ? structuredProblem.explicit_requirements 
      : [];
    
    console.log("Requirements to save:", requirements);
    
    const problemResult = await insertProblem({
      title: problemDesc.substring(0, 100),
      description: problemDesc,
      category: "general",
      explicit_requirements: requirements
    });

    if (!problemResult.success) {
      return handleError(res, new Error(problemResult.error), "DB_ERROR");
    }

    const problem_id = problemResult.problem_id;

    res.json({
      success: true,
      problem_id: problem_id,
      // structured_problem: structuredProblem,
      structured_problem: {
        problem_summary: structuredProblem.problem_summary,
        explicit_requirements: structuredProblem.explicit_requirements,
        implicit_requirements: structuredProblem.implicit_requirements,
        constraints: structuredProblem.constraints,
        acceptance_criteria: structuredProblem.acceptance_criteria
      }
    });
  } catch (error) {
    handleError(res, error, "STRUCTURE_PROBLEM_ERROR");
  }
});


/**
 * POST /api/structure/solution
 * Body: { solutionDesc }
 * Returns: { structured_solution }
 */
app.post("/api/structure/solution", async (req, res) => {
  try {
    // console.log("POST /api/structure/solution - Input:", JSON.stringify(req.body, null, 2));
    const { solutionDesc } = req.body;

    if (!solutionDesc) {
      return res.status(400).json({
        error: "solutionDesc is required",
        code: "MISSING_FIELDS"
      });
    }

    // Call structurizeSolution to structure the solution description
    const structuredSolutionRaw = await structurizeSolution(solutionDesc);
    const structuredSolution = parseOllamaResponse(structuredSolutionRaw);

    res.json({
      success: true,
      structured_solution: {
        solution_summary: structuredSolution.solution_summary,
        solution_steps: structuredSolution.solution_steps,
        assumptions: structuredSolution.assumptions,
        claimed_outcomes: structuredSolution.claimed_outcomes
      }
    });
  } catch (error) {
    handleError(res, error, "STRUCTURE_SOLUTION_ERROR");
  }
});


/**
 * POST /api/solutions/validate
 * Body: { strProblem, strSolution, clarifyingNotes? }
 * Case 1 (no clarifyingNotes): calls evaluateSolution
 * Case 2 (with clarifyingNotes): calls reEvaluateSolution
 * Returns: { evaluation_result }
 */
app.post("/api/solutions/validate", async (req, res) => {
  try {
    // console.log("POST /api/solutions/validate - Input:", JSON.stringify(req.body, null, 2));
    const { strProblem, strSolution, clarifyingNotes } = req.body;

    if (!strProblem || !strSolution) {
      return res.status(400).json({
        error: "strProblem and strSolution are required",
        code: "MISSING_FIELDS"
      });
    }

    let evaluationResultRaw;

    // Case 1: No clarifying notes - initial evaluation
    if (!clarifyingNotes) {
      console.log("Case 1: Initial evaluation (no clarifying notes)");
      evaluationResultRaw = await evaluateSolution(strProblem, strSolution);
    }
    // Case 2: With clarifying notes - re-evaluation
    else {
      console.log("Case 2: Re-evaluation with clarifying notes");
      evaluationResultRaw = await reEvaluateSolution(strProblem, strSolution, clarifyingNotes);
    }
    // console.log("Raw evaluation result:", evaluationResultRaw);
    const evaluationResult = parseOllamaResponse(evaluationResultRaw);
    console.log(evaluationResult);
    
    res.json({
      success: true,
      evaluation_result: {
        requirement_coverage: evaluationResult.requirement_coverage || [],
        unaddressed_constraints: evaluationResult.unaddressed_constraints || [],
        unsatisfied_acceptance_criteria: evaluationResult.unsatisfied_acceptance_criteria || [],
        extra_solution_features: evaluationResult.extra_solution_features || [],
        coverage_score: evaluationResult.coverage_score || 0,
        verdict: evaluationResult.verdict || "insufficient",
        missing_or_weak_points: evaluationResult.missing_or_weak_points || [],
        clarifying_questions: evaluationResult.clarifying_questions || []
    }
    });
  } catch (error) {
    handleError(res, error, "VALIDATION_ERROR");
  }
});


/**
 * POST /api/generate/notes
 * Body: { questionsArray, answersArray }
 * Returns: { clarifying_notes }
 */
app.post("/api/generate/notes", async (req, res) => {
  try {
    // console.log("POST /api/generate/notes - Input:", JSON.stringify(req.body, null, 2));
    const { questionsArray, answersArray } = req.body;

    if (!questionsArray || !answersArray) {
      return res.status(400).json({
        error: "questionsArray and answersArray are required",
        code: "MISSING_FIELDS"
      });
    }

    if (!Array.isArray(questionsArray) || !Array.isArray(answersArray)) {
      return res.status(400).json({
        error: "questionsArray and answersArray must be arrays",
        code: "INVALID_FORMAT"
      });
    }

    if (questionsArray.length !== answersArray.length) {
      return res.status(400).json({
        error: "questionsArray and answersArray must have the same length",
        code: "LENGTH_MISMATCH"
      });
    }

    // Call generateNotes to synthesize clarifying notes
    const notesRaw = await generateNotes(questionsArray, answersArray);
    const notes = parseOllamaResponse(notesRaw);

    res.json({
      success: true,
      clarifying_notes: notes.clarifying_notes || []
    });
  } catch (error) {
    handleError(res, error, "GENERATE_NOTES_ERROR");
  }
});

  
/**
 * POST /api/solutions/save
 * Body: { session_id, problem_id, evaluation_result, structured_problem, structured_solution, clarifying_notes,  }
 * Returns: { success, solution_id, saved_at, root_cause }
 */
app.post("/api/solutions/save", async (req, res) => {
  try {
    // console.log("POST /api/solutions/save - Input:", JSON.stringify(req.body, null, 2));
    const { session_id, problem_id, strProblem, strSolution, clarifyingNotes } = req.body;

    if (!session_id || !problem_id || !strProblem || !strSolution) {
      return res.status(400).json({
        error: "session_id, problem_id, structured_problem, and structured_solution are required",
        code: "MISSING_FIELDS"
      });
    }

    // Step 1: Call updateSolution to enhance the solution with clarifying notes
    console.log("Step 1: Enhancing solution with clarifying notes...");
    const enhancedSolutionRaw = clarifyingNotes 
      ? await updateSolution(strProblem, strSolution, clarifyingNotes)
      : strProblem;
    const enhancedSolution = parseOllamaResponse(enhancedSolutionRaw);
    
    // Step 2: Create a solution entry in the database with the given schema
    console.log("Step 2: Saving solution to database...");
    const solution_id = uuidv4();
    const solutionResult = await insertSolution({
      solution_id: solution_id,
      problem_id: problem_id,
      session_id: session_id,
      solution_steps: enhancedSolution.solution_steps||strSolution.solution_steps,
      claimed_outcomes: enhancedSolution.claimed_outcomes || strSolution.claimed_outcomes,
    });

    if (!solutionResult.success) {
      return handleError(res, new Error(solutionResult.error), "DB_INSERT_ERROR");
    }

    // Step 3: Call findRootCause to find the root cause with strProblem and enhanced solution
    console.log("Step 3: Finding root cause...");
    const rootCauseAnalysisRaw = await findRootCause(strProblem, enhancedSolution);
    const rootCauseAnalysis = parseOllamaResponse(rootCauseAnalysisRaw);

    // Step 4: Save solution_id and root_cause to problem
    console.log("Step 4: Updating problem with solution_id and root_cause...");
    const rootCauseResult = await updateProblemWithRootCause(
      problem_id,
      {
        cause: rootCauseAnalysis.cause || "",
        root_cause_summary: rootCauseAnalysis.root_cause_summary || "",
      },
      solution_id
    );

    if (!rootCauseResult.success) {
      return handleError(res, new Error(rootCauseResult.error), "DB_UPDATE_ERROR");
    }

    // Step 5: Update session status to "solution_saved"
    console.log("Step 5: Updating session status...");
    const sessionUpdateResult = await updateChatSessionStatus(session_id, solution_id);

    if (!sessionUpdateResult.success) {
      return handleError(res, new Error(sessionUpdateResult.error), "SESSION_UPDATE_ERROR");
    }

    // Return solution_id, root_cause & solution_summary
    res.json({
      success: true,
      solution_id: solution_id,
      saved_at: new Date().toISOString(),
      root_cause: {
        cause: rootCauseAnalysis.cause || "",
        root_cause_summary: rootCauseAnalysis.root_cause_summary || "",
      }
    });
  } catch (error) {
    handleError(res, error, "SAVE_SOLUTION_ERROR");
  }
});

/**
 * POST /api/session/save
 * Body: { session_id, problem_description, initial_solution, clarifying_questions, clarifying_solutions, solution_details }
 * Returns: { success, solution_id, saved_at }
 */
app.post("/api/session/save", async (req, res) => {
  try {
    // console.log("POST /api/session/save - Input:", JSON.stringify(req.body, null, 2));
    const { 
      session_id, 
      problem_id,
      solution_id,
      problem_description, 
      initial_solution,
      clarifying_questions,
      clarifying_solutions,
    } = req.body;

    if (!session_id || !problem_description) {
      return res.status(400).json({
        error: "session_id and problem_description are required",
        code: "MISSING_FIELDS"
      });
    }

    // Get current session from database to retrieve user_id and other details
    const session = await getChatSession(session_id);
    if (!session) {
      return res.status(404).json({
        error: "Session not found",
        code: "SESSION_NOT_FOUND"
      });
    }

    // Update session with all schema fields
    const updateData = {
      session_id: session_id,
      problem_id: problem_id,
      solution_id: solution_id,
      user_id: session.user_id,
      status: "closed",
      problem_description: problem_description,
      initial_solution: initial_solution || null,
      clarifying_questions: Array.isArray(clarifying_questions) ? clarifying_questions : [],
      clarifying_solutions: Array.isArray(clarifying_solutions) ? clarifying_solutions : [],
      created_at: session.created_at || new Date()
    };



    // Also update session with additional fields using direct Mongoose update
    await ChatSession.updateOne(
      { session_id: session_id },
      updateData
    );

    console.log("Step: Session saved with all fields successfully");

    res.json({
      success: true,
      session_id: session_id,
      saved_at: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, "SAVE_SESSION_ERROR");
  }
});


/**
 * Health check endpoint
 * Used to verify server and database connectivity
 * Returns status and message indicating server health
 */
app.get("/health", async (req, res) => {
  try {
    console.log("GET /health - Health check requested");
    // Test database connection
    await getDB();
    // Return success status
    res.json({ status: "ok", message: "Server is running" });
  } catch (error) {
    // Return error if database connection fails
    res.status(500).json({ status: "error", message: error.message });
  }
});


/**
 * Start the Express server
 * Listens on the configured PORT and logs server URL
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

