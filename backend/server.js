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
  analyzeProblem,
  analyzeUserSolution,
  generateFollowUpQuestions,
  validateSolutionAgainstOld,
  formatSolutionStructure
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
    const { session_id, user_message, message_type } = req.body;

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

    // Retrieve session from database to verify it exists
    const session = await getChatSession(session_id);
    if (!session) {
      return res.status(404).json({
        error: "Session not found",
        code: "SESSION_NOT_FOUND"
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
    const problem = await getProblem(session.problem_id);

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
 * POST /api/solutions/validate
 * Body: { user_solution, problem_id }
 * Returns: { validation_result: { matches: bool, percentage: num }, status: "matches_existing" / "new_solution" / "too_generic" }
 */
app.post("/api/solutions/validate", async (req, res) => {
  try {
    console.log("POST /api/solutions/validate - Input:", JSON.stringify(req.body, null, 2));
    const { user_solution, problem_id } = req.body;

    if (!user_solution || !problem_id) {
      return res.status(400).json({
        error: "user_solution and problem_id are required",
        code: "MISSING_FIELDS"
      });
    }

    // Retrieve all existing solutions for this problem from database
    const existingSolutions = await getSolutionsByProblemId(problem_id);
    
    // If no existing solutions, this is automatically a new solution
    if (existingSolutions.length === 0) {
      return res.json({
        validation_result: {
          matches: false,
          percentage: 0
        },
        status: "new_solution"
      });
    }

    // Combine root cause and solution details from each existing solution
    // This creates full solution text for comparison
    const oldSolutionsTexts = existingSolutions.map(sol => 
      `${sol.root_cause_analysis}\n${sol.solution_details}`
    );

    // Use Ollama to compare new solution against existing ones
    // Returns match percentage and whether it matches
    const validationResult = await validateSolutionAgainstOld(
      user_solution,
      oldSolutionsTexts
    );

    // Determine validation status based on match percentage
    let status = "new_solution";
    // If matches and percentage >= 80%, it's considered a match
    if (validationResult.matches && validationResult.matchPercentage >= 80) {
      status = "matches_existing";
    } 
    // If percentage < 30%, solution is too generic
    else if (validationResult.matchPercentage < 30) {
      status = "too_generic";
    }
    // Otherwise it's a new solution (partial match)

    res.json({
      validation_result: {
        matches: validationResult.matches,
        percentage: validationResult.matchPercentage
      },
      status: status,
      existing_solutions_count: existingSolutions.length
    });
  } catch (error) {
    handleError(res, error, "VALIDATION_ERROR");
  }
});

/**
 * POST /api/solutions/save
 * Body: { session_id, problem_description, root_cause_analysis, solution_details }
 * Returns: { success, solution_id, saved_at }
 */
app.post("/api/solutions/save", async (req, res) => {
  try {
    console.log("POST /api/solutions/save - Input:", JSON.stringify(req.body, null, 2));
    const { session_id, problem_description, root_cause_analysis, solution_details } = req.body;

    if (!session_id || !problem_description || !root_cause_analysis || !solution_details) {
      return res.status(400).json({
        error: "session_id, problem_description, root_cause_analysis, and solution_details are required",
        code: "MISSING_FIELDS"
      });
    }

    // Retrieve session to get problem_id for linking solution to problem
    const session = await getChatSession(session_id);
    if (!session) {
      return res.status(404).json({
        error: "Session not found",
        code: "SESSION_NOT_FOUND"
      });
    }

    // Format solution using LLM to create structured document
    // This improves readability and consistency
    let formattedSolution = solution_details;
    try {
      formattedSolution = await formatSolutionStructure(
        problem_description,
        root_cause_analysis,
        solution_details
      );
    } catch (error) {
      // If formatting fails, use original solution text
      console.warn("Failed to format solution, using original:", error.message);
    }

    // Save solution to database with metadata
    const solutionResult = await insertSolution({
      problem_id: session.problem_id, // Link to the problem
      root_cause_analysis: root_cause_analysis,
      solution_details: formattedSolution, // Use formatted version
      source: "human", // Mark as human-provided solution
      confidence_score: null, // Can be set later
      verified_by_count: 0 // No verifications yet
    });
    
    // After saving successfully, update session status
    if (solutionResult.success) {
      // Ensure database connection is active
      await getDB();

      // Update session record to mark solution as saved
      // Store solution_id in session for easy reference
      await ChatSession.updateOne(
        { session_id: session_id },
        {
          $set: {
            status: "solution_saved", // Change status to indicate completion
            solution_id: solutionResult.solution_id // Store solution ID
          }
        }
      );
    }

    if (!solutionResult.success) {
      return handleError(res, new Error(solutionResult.error), "SAVE_ERROR");
    }

    res.json({
      success: true,
      solution_id: solutionResult.solution_id,
      saved_at: new Date().toISOString()
    });
  } catch (error) {
    handleError(res, error, "SAVE_SOLUTION_ERROR");
  }
});

/**
 * GET /api/solutions/:problem_id
 * Returns: { solutions: [array of solution objects] }
 */
// app.get("/api/solutions/:problem_id", async (req, res) => {
//   try {
//     console.log("GET /api/solutions/:problem_id - Input:", JSON.stringify(req.params, null, 2));
//     const { problem_id } = req.params;

//     if (!problem_id) {
//       return res.status(400).json({
//         error: "problem_id is required",
//         code: "MISSING_FIELDS"
//       });
//     }

//     // Retrieve all solutions for the specified problem
//     const solutions = await getSolutionsByProblemId(problem_id);
  
//     // Return solutions array (empty if none found)
//     res.json({
//       solutions: solutions
//     });
//   } catch (error) {
//     handleError(res, error, "GET_SOLUTIONS_ERROR");
//   }
// });

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

