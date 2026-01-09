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
  findSimilarProblems,
  getProblem,
  insertSolution,
  getSolutionsByProblemId,
  createChatSession,
  getChatSession,
  addChatMessage,
  getChatMessages
} from "../database/db.js";

// Import Mongoose for session updates
import mongoose from "mongoose";
import { chatSessionSchema } from "../models/schemas.js";

// Create ChatSession model for direct database updates
const ChatSession = mongoose.model("ChatSession", chatSessionSchema);

// Import Ollama client functions for AI operations
import {
  structurizeProbem,
  structurizeSolution,
  evaluateSolution,
  generateNotes,
  reEvaluateSolution,
  updateSolution,
  findRootCause,
  summarizeSolution
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
 * POST /api/chat/start
 * Body: { user_id, problem_description }
 * Returns: { session_id, ai_response }
 */
app.post("/api/chat/start", async (req, res) => {
  try {
    console.log("POST /api/chat/start - Input:", JSON.stringify(req.body, null, 2));
    const { user_id, problem_description } = req.body;

    if (!user_id || !problem_description) {
      return res.status(400).json({
        error: "user_id and problem_description are required",
        code: "MISSING_FIELDS"
      });
    }

    // Initialize database connection
    await getDB();

    // Generate session_id (uuid)
    const session_id = uuidv4();

    // Create problem entry
    const problemResult = await insertProblem({
      title: problem_description.substring(0, 100),
      description: problem_description,
      category: "general"
    });
    // console.log(problemResult);
    
    if (!problemResult.success) {
      return handleError(res, new Error(problemResult.error), "DB_ERROR");
    }

    const problem_id = problemResult.problem_id;

    // Find similar problems (for internal LLM context only)
    const similarProblems = await findSimilarProblems(problem_description, 5);

    // Call ollamaClient.analyzeProblem with similar problems for context
    // LLM uses similar_problems internally but returns only the simple question
    let ai_response = "";
    try {
      const result = await analyzeProblem(problem_description, similarProblems);
      console.log(result);
      
      ai_response = result.ai_response;
    } catch (error) {
      // Fallback to exact response on error
      console.log(error.message)
      ai_response = "I understand the problem. How did you solve this?";
    }

    // Save session to DB with status "waiting_solution"
    const sessionResult = await createChatSession({
      session_id: session_id,
      user_id: user_id,
      problem_id: problem_id,
      status: "waiting_solution"
    });

    if (!sessionResult.success) {
      return handleError(res, new Error(sessionResult.error), "SESSION_CREATE_ERROR");
    }

    res.json({
      session_id: session_id,
      ai_response: ai_response,
      problem_id: problem_id
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
    console.log("POST /api/chat/message - Input:", JSON.stringify(req.body, null, 2));
    const { session_id, user_message, message_type, problem_id } = req.body;

    // Validate all required fields are present
    if (!session_id || !user_message || !message_type) {
      return res.status(400).json({
        error: "session_id, user_message, and message_type are required",
        code: "MISSING_FIELDS"
      });
    }

    // Validate message_type is one of the allowed values
    if (!["user_solution", "response"].includes(message_type)) {
      return res.status(400).json({
        error: "message_type must be 'user_solution' or 'response'",
        code: "INVALID_MESSAGE_TYPE"
      });
    }

    // Save user's message to chat history in database
    await addChatMessage({
      session_id: session_id,
      role: "user",
      content: user_message
    });

    // Retrieve full chat history for context
    const messages = await getChatMessages(session_id);
    // Get problem details for context in AI responses
    const problem = await getProblem(problem_id);

    // Initialize response variables
    let aiResponse = "";
    let nextAction = "ask_followup";

    // Handle different message types differently
    if (message_type === "user_solution") {
      // User is providing their solution - analyze it with LLM
      try {
        aiResponse = await analyzeUserSolution(user_message);
        // After analysis, next step is to validate against existing solutions
        nextAction = "validate";
      } catch (error) {
        // Fallback response if analysis fails
        aiResponse = "Thank you for providing your solution. I'll validate it against existing solutions.";
        nextAction = "validate";
      }
    } else if (message_type === "response") {
      // User is responding to a question - generate follow-up questions
      try {
        // Use problem description for context
        const problemDesc = problem?.description || "Technical issue";
        // Generate follow-up questions using Ollama
        const questionsResult = await generateFollowUpQuestions(
          user_message,
          problemDesc
        );
        
        // Check if questions were generated successfully
        if (questionsResult.questions && questionsResult.questions.length > 0) {
          // Format questions as numbered list
          aiResponse = `Here are some follow-up questions to help improve the solution:\n\n${questionsResult.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`;
          nextAction = "ask_followup";
        } else {
          // No more questions - ready to save
          aiResponse = "Thank you for the additional information. Would you like to save this solution?";
          nextAction = "save_solution";
        }
      } catch (error) {
        // Fallback if question generation fails
        aiResponse = "I understand. Would you like to proceed with saving this solution?";
        nextAction = "save_solution";
      }
    }

    // Save AI's response to chat history
    await addChatMessage({
      session_id: session_id,
      role: "assistant",
      content: aiResponse
    });

    res.json({
      response: aiResponse,
      next_action: nextAction
    });
  } catch (error) {
    handleError(res, error, "CHAT_MESSAGE_ERROR");
  }
});


/**
 * POST /api/structure/problem
 * Body: { problemDesc }
 * Returns: { structured_problem }
 */
app.post("/api/structure/problem", async (req, res) => {
  try {
    console.log("POST /api/structure/problem - Input:", JSON.stringify(req.body, null, 2));
    const { problemDesc } = req.body;

    if (!problemDesc) {
      return res.status(400).json({
        error: "problemDesc is required",
        code: "MISSING_FIELDS"
      });
    }

    // Call structurizeProbem to structure the problem description
    const structuredProblem = await structurizeProbem(problemDesc);

    res.json({
      success: true,
      structured_problem: structuredProblem
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
    console.log("POST /api/structure/solution - Input:", JSON.stringify(req.body, null, 2));
    const { solutionDesc } = req.body;

    if (!solutionDesc) {
      return res.status(400).json({
        error: "solutionDesc is required",
        code: "MISSING_FIELDS"
      });
    }

    // Call structurizeSolution to structure the solution description
    const structuredSolution = await structurizeSolution(solutionDesc);

    res.json({
      success: true,
      structured_solution: structuredSolution
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
    console.log("POST /api/solutions/validate - Input:", JSON.stringify(req.body, null, 2));
    const { strProblem, strSolution, clarifyingNotes } = req.body;

    if (!strProblem || !strSolution) {
      return res.status(400).json({
        error: "strProblem and strSolution are required",
        code: "MISSING_FIELDS"
      });
    }

    let evaluationResult;

    // Case 1: No clarifying notes - initial evaluation
    if (!clarifyingNotes) {
      console.log("Case 1: Initial evaluation (no clarifying notes)");
      evaluationResult = await evaluateSolution(strProblem, strSolution);
    }
    // Case 2: With clarifying notes - re-evaluation
    else {
      console.log("Case 2: Re-evaluation with clarifying notes");
      evaluationResult = await reEvaluateSolution(strProblem, strSolution, clarifyingNotes);
    }

    res.json({
      success: true,
      evaluation_result: evaluationResult
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
    console.log("POST /api/generate/notes - Input:", JSON.stringify(req.body, null, 2));
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
    const notes = await generateNotes(questionsArray, answersArray);

    res.json({
      success: true,
      clarifying_notes: notes
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
    console.log("POST /api/solutions/save - Input:", JSON.stringify(req.body, null, 2));
    const { session_id, problem_id, structured_problem, structured_solution, clarifying_notes } = req.body;

    if (!session_id || !problem_id || !structured_problem || !structured_solution) {
      return res.status(400).json({
        error: "session_id, problem_id, structured_problem, and structured_solution are required",
        code: "MISSING_FIELDS"
      });
    }

    // Step 1: Call updateSolution to enhance the solution with clarifying notes
    console.log("Step 1: Enhancing solution with clarifying notes...");
    const enhancedSolution = clarifying_notes 
      ? await updateSolution(structured_problem, structured_solution, clarifying_notes)
      : structured_solution;

    // Step 2: Create a solution entry in the database with the given schema
    console.log("Step 2: Saving solution to database...");
    const solution_id = uuidv4();
    const solutionResult = await insertSolution({
      solution_id: solution_id,
      problem_id: problem_id,
      session_id: session_id,
      solution_steps: enhancedSolution.solution_steps || enhancedSolution,
      claimed_outcomes: enhancedSolution.claimed_outcomes || []
    });

    if (!solutionResult.success) {
      return handleError(res, new Error(solutionResult.error), "DB_INSERT_ERROR");
    }

    // Step 3: Call findRootCause to find the root cause with strProblem and updated solution
    console.log("Step 3: Finding root cause...");
    const rootCauseAnalysis = await findRootCause(structured_problem, enhancedSolution);

    // Step 4: Save solution_id and root_cause to problem
    console.log("Step 4: Updating problem with solution_id and root_cause...");
    const problem = await getProblem(problem_id);
    if (problem && problem._id) {
      // Update the problem with solution reference and root cause
      await ChatSession.updateOne(
        { _id: problem._id },
        {
          $addToSet: { 
            solutions: { solution_id: solution_id, times_used: 1 }
          }
        }
      );
    }

    // Step 5: Generate solution summary (summarizeSolution)
    console.log("Step 5: Generating solution summary...");
    const solutionSummary = await summarizeSolution(structured_problem, enhancedSolution);

    // Step 6: Update session status to "solution_saved"
    console.log("Step 6: Updating session status...");
    await ChatSession.updateOne(
      { session_id: session_id },
      { 
        status: "solution_saved",
        solution_id: solution_id
      }
    );

    // Return solution_id, root_cause & solution_summary
    res.json({
      success: true,
      solution_id: solution_id,
      saved_at: new Date().toISOString(),
      root_cause: rootCauseAnalysis,
      solution_summary: solutionSummary
    });
  } catch (error) {
    handleError(res, error, "SAVE_SOLUTION_ERROR");
  }
});

/**
 * POST /api/session/save
 * Body: { session_id, problem_description, root_cause_analysis, solution_details }
 * Returns: { success, solution_id, saved_at }
 */
app.post("/api/session/save", async (req, res) => {
  try {
    console.log("POST /api/session/save - Input:", JSON.stringify(req.body, null, 2));
    const { session_id, problem_description, root_cause_analysis, solution_details } = req.body;

    if (!session_id || !problem_description || !solution_details) {
      return res.status(400).json({
        error: "session_id, problem_description, and solution_details are required",
        code: "MISSING_FIELDS"
      });
    }

    // Get current session from database
    const session = await getChatSession(session_id);
    if (!session) {
      return res.status(404).json({
        error: "Session not found",
        code: "SESSION_NOT_FOUND"
      });
    }

    // Create new solution entry
    const solution_id = uuidv4();
    const solutionResult = await insertSolution({
      solution_id: solution_id,
      problem_id: session.problem_id,
      session_id: session_id,
      solution_steps: solution_details.steps || solution_details,
      claimed_outcomes: solution_details.outcomes || []
    });

    if (!solutionResult.success) {
      return handleError(res, new Error(solutionResult.error), "DB_INSERT_ERROR");
    }

    // Update session status to "solution_saved" and link solution
    await ChatSession.updateOne(
      { session_id: session_id },
      {
        status: "solution_saved",
        solution_id: solution_id
      }
    );

    res.json({
      success: true,
      solution_id: solution_id,
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
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

