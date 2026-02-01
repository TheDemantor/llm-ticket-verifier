import mongoose from "mongoose";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import {
  problemSchema,
  solutionSchema,
  chatSessionSchema,
  chatMessageSchema
} from "../models/schemas.js";

// Load environment variables
dotenv.config();

// Create Mongoose models from schemas for database operations
// These models provide methods for CRUD operations
const Problem = mongoose.model("Problem", problemSchema);
const Solution = mongoose.model("Solution", solutionSchema);
const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

// Cache database connection instance to avoid reconnecting
let db = null;


/**
 * Connects to MongoDB and returns the database instance
 * Uses connection pooling - reuses existing connection if available
 * @returns {Promise<Object>} Database instance
 */
export async function getDB() {
  try {
    // Return cached connection if already established
    if (db) {
      return db;
    }

    // Get connection details from environment variables
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME;

    // Validate required environment variables are set
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }

    if (!dbName) {
      throw new Error("DB_NAME is not defined in environment variables");
    }

    // Connect to MongoDB using Mongoose
    await mongoose.connect(mongoUri, {
      dbName: dbName // Specify database name
    });

    // Cache the database instance for reuse
    db = mongoose.connection.db;
    return db;
  } catch (error) {
    throw new Error(`Failed to connect to MongoDB: ${error.message}`);
  }
}


/**
 * Inserts a new problem into the database
 * Creates a problem record with unique ID and timestamps
 * @param {Object} problemData - Problem data object with title, description, category
 * @returns {Promise<{success: boolean, problem_id?: string, error?: string}>}
 */
export async function insertProblem(problemData) {
  try {
    // Ensure database connection is established
    await getDB();

    // Generate unique problem ID using UUID
    const problem_id = uuidv4();
    
    // Create new Problem document
    const problem = new Problem({
      problem_id: problem_id,
      title: problemData.title,
      description: problemData.description,
      category: problemData.category,
      explicit_requirements: problemData.explicit_requirements || [],
      created_at: new Date() // Set creation timestamp
    });

    console.log("Saving problem to DB:", JSON.stringify(problem, null, 2));

    // Save to database
    await problem.save();

    // Return success with generated problem ID
    return { success: true, problem_id: problem_id };
  } catch (error) {
    // Return error in structured format
    return { success: false, error: error.message };
  }
}


/**
 * Gets a problem by problem_id
 * @param {string} problem_id - Problem ID
 * @returns {Promise<Object|null>} Problem object or null
 */
// export async function getProblem(problem_id) {
//   try {
//     await getDB();

//     const problem = await Problem.findOne({ problem_id: problem_id }).lean();

//     return problem || null;
//   } catch (error) {
//     return null;
//   }
// }


/**
 * Inserts a new solution into the database
 * Creates a solution record linked to a problem with validation metadata
 * @param {Object} solutionData - Solution data with problem_id, root_cause_analysis, solution_details, source, etc.
 * @returns {Promise<{success: boolean, solution_id?: string, error?: string}>}
 */
export async function insertSolution(solutionData) {
  try {
    // Ensure database connection
    await getDB();

    // Generate unique solution ID
    const solution_id = uuidv4();
    
    // Create new Solution document with all required fields
    const solution = new Solution({
      solution_id: solution_id,
      problem_id: solutionData.problem_id, // Link to the problem
      session_id: solutionData.session_id, // Link to chat session
      solution_steps: solutionData.solution_steps, // Detailed steps
      claimed_outcomes: solutionData.claimed_outcomes, // Expected outcomes
      created_at: new Date(), // Timestamp
      verified_by_count: solutionData.verified_by_count || 0 // Number of times verified
    });

    // Save to database
    await solution.save();

    // Return success with generated solution ID
    return { success: true, solution_id: solution_id };
  } catch (error) {
    // Return error in structured format
    return { success: false, error: error.message };
  }
}


/**
 * Gets a solution by solution_id
 * Retrieves a single solution document from the database
 * @param {string} solution_id - Solution ID to search for
 * @returns {Promise<Object|null>} Solution object or null if not found
 */
// export async function getSolution(solution_id) {
//   try {
//     // Ensure database connection
//     await getDB();

//     // Find solution by ID, return as plain object (lean)
//     const solution = await Solution.findOne({ solution_id: solution_id }).lean();

//     // Return solution or null if not found
//     return solution || null;
//   } catch (error) {
//     // Return null on error to allow graceful handling
//     return null;
//   }
// }


/**
 * Adds a follow-up question to a solution
 * @param {string} solutionId - Solution ID
 * @param {Object} question - Question data object
 * @returns {Promise<{success: boolean, question_id?: string, error?: string}>}
 */
// export async function addFollowUpQuestion(solutionId, question) {
//   try {
//     await getDB();

//     const question_id = uuidv4();
//     const followUpQuestion = new FollowUpQuestion({
//       question_id: question_id,
//       solution_id: solutionId,
//       category: question.category,
//       is_answered: false,
//       response: null
//     });

//     await followUpQuestion.save();

//     return { success: true, question_id: question_id };
//   } catch (error) {
//     return { success: false, error: error.message };
//   }
// }


/**
 * Updates a follow-up question with a response
 * @param {string} questionId - Question ID
 * @param {string} response - Response text
 * @returns {Promise<{success: boolean, error?: string}>}
 */
// export async function updateFollowUpQuestion(questionId, response) {
//   try {
//     await getDB();

//     const result = await FollowUpQuestion.updateOne(
//       { question_id: questionId },
//       {
//         $set: {
//           response: response,
//           is_answered: true
//         }
//       }
//     );

//     if (result.matchedCount === 0) {
//       return { success: false, error: "Question not found" };
//     }

//     return { success: true };
//   } catch (error) {
//     return { success: false, error: error.message };
//   }
// }


/**
 * Creates a new chat session
 * Initializes a chat session with user, problem, and status tracking
 * @param {Object} sessionData - Session data with session_id (optional), user_id, problem_id, status
 * @returns {Promise<{success: boolean, session_id?: string, error?: string}>}
 */
export async function createChatSession(sessionData) {
  try {
    // Ensure database connection
    await getDB();

    // Use provided session_id or generate new UUID
    const session_id = sessionData.session_id || uuidv4();
    
    // Create new ChatSession document
    const session = new ChatSession({
      session_id: session_id,
      user_id: sessionData.user_id, // Link to user
      problem_id: sessionData.problem_id, // Link to problem
      status: sessionData.status || "active", // Default to "active" if not specified
      created_at: new Date(), // Creation timestamp
      messages_count: 0 // Initialize message counter
    });

    // Save to database
    await session.save();

    // Return success with session ID
    return { success: true, session_id: session_id };
  } catch (error) {
    // Return error in structured format
    return { success: false, error: error.message };
  }
}


/**
 * Gets a chat session by session_id
 * @param {string} session_id - Session ID
 * @returns {Promise<Object|null>} Session object or null
 */
export async function getChatSession(session_id) {
  try {
    await getDB();

    const session = await ChatSession.findOne({ session_id: session_id }).lean();

    return session || null;
  } catch (error) {
    return null;
  }
}


/**
 * Adds a message to a chat session
 * Saves message and increments session message counter
 * @param {Object} messageData - Message data with session_id, role, content
 * @returns {Promise<{success: boolean, message_id?: string, error?: string}>}
 */
export async function addChatMessage(messageData) {
  try {
    // Ensure database connection
    await getDB();

    // Generate unique message ID
    const message_id = uuidv4();
    
    // Create new ChatMessage document
    const message = new ChatMessage({
      message_id: message_id,
      session_id: messageData.session_id, // Link to session
      role: messageData.role, // "user" or "assistant"
      content: messageData.content, // Message text
      timestamp: new Date() // Message timestamp
    });

    // Save message to database
    await message.save();

    // Update session's message count atomically
    // Uses $inc operator to increment counter safely
    await ChatSession.updateOne(
      { session_id: messageData.session_id },
      { $inc: { messages_count: 1 } } // Increment by 1
    );

    // Return success with message ID
    return { success: true, message_id: message_id };
  } catch (error) {
    // Return error in structured format
    return { success: false, error: error.message };
  }
}


/**
 * Gets all messages for a chat session
 * @param {string} session_id - Session ID
 * @returns {Promise<Array>} Array of message objects
 */
// export async function getChatMessages(session_id) {
//   try {
//     await getDB();

//     const messages = await ChatMessage.find({ session_id: session_id })
//       .sort({ timestamp: 1 })
//       .lean();

//     return messages;
//   } catch (error) {
//     return [];
//   }
// }


/**
 * Gets all solutions for a problem
 * Retrieves all solutions linked to a specific problem, sorted by newest first
 * @param {string} problem_id - Problem ID to search for
 * @returns {Promise<Array>} Array of solution objects
 */
// export async function getSolutionsByProblemId(problem_id) {
//   try {
//     // Ensure database connection
//     await getDB();

//     // Find all solutions for this problem
//     const solutions = await Solution.find({ problem_id: problem_id })
//       .sort({ created_at: -1 }) // Sort by newest first
//       .lean(); // Return as plain objects

//     return solutions;
//   } catch (error) {
//     // Return empty array on error to allow flow to continue
//     return [];
//   }
// }


/**
 * Updates a problem with root cause analysis and adds a solution reference
 * Saves root cause information and links the solution to the problem
 * @param {string} problem_id - Problem ID to update
 * @param {Object} rootCauseData - Root cause data with cause and root_cause_summary
 * @param {string} solution_id - Solution ID to add to solutions array
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateProblemWithRootCause(problem_id, rootCauseData, solution_id) {
  try {
    // Ensure database connection
    await getDB();

    // Find problem by problem_id first
    const problem = await Problem.findOne({ problem_id: problem_id });
    if (!problem) {
      return { success: false, error: "Problem not found" };
    }

    // Update problem with root cause and push new solution to solutions array
    const result = await Problem.updateOne(
      { _id: problem._id },
      {
        root_cause: {
          cause: rootCauseData.cause,
          root_cause_summary: rootCauseData.root_cause_summary
        },
        $push: {
          solutions: {
            solutions_id: solution_id,
            times_used: 1
          }
        }
      }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "Problem not found during update" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}


/**
 * Updates a chat session status and links a solution
 * Marks session as complete and stores the solution reference
 * @param {string} session_id - Session ID to update
 * @param {string} solution_id - Solution ID to link
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateChatSessionStatus(session_id, solution_id) {
  try {
    // Ensure database connection
    await getDB();

    // Update session status to "solution_saved" and link solution
    const result = await ChatSession.updateOne(
      { session_id: session_id },
      {
        status: "solution_saved",
        solution_id: solution_id
      }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: "Chat session not found" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

