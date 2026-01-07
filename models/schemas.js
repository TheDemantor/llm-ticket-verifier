// Import Mongoose for schema definitions
import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Problem Schema - Stores IT support problem descriptions
 * Collection: problems_collection
 * Fields:
 * - problem_id: Unique identifier (indexed, unique)
 * - title: Short problem title
 * - description: Full problem description
 * - category: Problem category for organization
 * - created_at: Creation timestamp
 * - last_updated: Last update timestamp
 */
export const problemSchema = new Schema(
  {
    problem_id: { type: String, required: true }, // Unique problem identifier
    title: { type: String, required: true }, // Problem title
    description: { type: String, required: true }, // Full problem description
    category: { type: String, required: true }, // Problem category
    created_at: { type: Date, default: Date.now, required: true }, // Auto-set on creation
    last_updated: { type: Date, default: Date.now, required: true } // Auto-set on creation
  },
  { collection: "problems_collection" } // Specify collection name
);

// Create indexes for efficient queries
problemSchema.index({ problem_id: 1 }, { unique: true }); // Unique index on problem_id
problemSchema.index({ category: 1 }); // Index on category for filtering

/**
 * Solution Schema - Stores IT support solutions
 * Collection: solutions_collection
 * Fields:
 * - solution_id: Unique identifier (indexed, unique)
 * - problem_id: Link to problem (indexed)
 * - root_cause_analysis: Analysis of root cause
 * - solution_details: Detailed solution steps
 * - source: "human" or "ai" (enum)
 * - confidence_score: Optional confidence score
 * - created_at: Creation timestamp
 * - verified_by_count: Number of times verified
 */
export const solutionSchema = new Schema(
  {
    solution_id: { type: String, required: true }, // Unique solution identifier
    problem_id: { type: String, required: true }, // Link to problem
    root_cause_analysis: { type: String, required: true }, // Root cause explanation
    solution_details: { type: String, required: true }, // Step-by-step solution
    source: { type: String, enum: ["human", "ai"], required: true }, // Source type
    confidence_score: { type: Number }, // Optional confidence score
    created_at: { type: Date, default: Date.now, required: true }, // Creation timestamp
    verified_by_count: { type: Number, default: 0, required: true } // Verification counter
  },
  { collection: "solutions_collection" } // Specify collection name
);

// Create indexes for efficient queries
solutionSchema.index({ solution_id: 1 }, { unique: true }); // Unique index on solution_id
solutionSchema.index({ problem_id: 1 }); // Index on problem_id for finding all solutions

/**
 * Chat Session Schema - Tracks chat sessions and their status
 * Collection: chat_sessions_collection
 * Fields:
 * - session_id: Unique session identifier (indexed, unique)
 * - user_id: User/agent identifier (indexed)
 * - problem_id: Link to problem being discussed
 * - status: Session status - "active" | "closed" | "waiting_solution" | "solution_saved" (indexed)
 * - saved_solution_id: ID of saved solution (if solution was saved)
 * - created_at: Session creation timestamp
 * - messages_count: Number of messages in session
 */
export const chatSessionSchema = new Schema(
  {
    session_id: { type: String, required: true }, // Unique session ID
    user_id: { type: String, required: true }, // User identifier
    problem_id: { type: String, required: true }, // Link to problem
    status: { type: String, enum: ["active", "closed", "waiting_solution", "solution_saved"], required: true }, // Session status
    saved_solution_id: { type: String }, // Optional: ID of saved solution
    created_at: { type: Date, default: Date.now, required: true }, // Creation timestamp
    messages_count: { type: Number, default: 0, required: true } // Message counter
  },
  { collection: "chat_sessions_collection" } // Specify collection name
);

// Create indexes for efficient queries
chatSessionSchema.index({ session_id: 1 }, { unique: true }); // Unique index on session_id
chatSessionSchema.index({ user_id: 1 }); // Index on user_id for user's sessions
chatSessionSchema.index({ status: 1 }); // Index on status for filtering by status

/**
 * Chat Message Schema - Stores individual messages in chat conversations
 * Collection: chat_messages_collection
 * Fields:
 * - message_id: Unique message identifier
 * - session_id: Link to chat session (indexed)
 * - role: Message sender - "user" or "assistant" (enum)
 * - content: Message text content
 * - timestamp: Message timestamp (indexed, auto-set)
 */
export const chatMessageSchema = new Schema(
  {
    message_id: { type: String, required: true }, // Unique message ID
    session_id: { type: String, required: true }, // Link to session
    role: { type: String, enum: ["user", "assistant"], required: true }, // Message sender role
    content: { type: String, required: true }, // Message text
    timestamp: { type: Date, default: Date.now, required: true } // Message timestamp
  },
  { collection: "chat_messages_collection" } // Specify collection name
);

// Create indexes for efficient queries
chatMessageSchema.index({ session_id: 1 }); // Index on session_id for retrieving session messages
chatMessageSchema.index({ timestamp: 1 }); // Index on timestamp for chronological sorting

/**
 * Follow-up Question Schema - Stores follow-up questions for solutions
 * Collection: follow_up_questions_collection
 * Fields:
 * - question_id: Unique question identifier
 * - solution_id: Link to solution (indexed)
 * - category: Question type - "clarification" | "specificity" | "implementation" (enum)
 * - is_answered: Whether question has been answered (default: false)
 * - response: Answer text (optional, set when answered)
 */
export const followUpQuestionSchema = new Schema(
  {
    question_id: { type: String, required: true }, // Unique question ID
    solution_id: { type: String, required: true }, // Link to solution
    category: {
      type: String,
      enum: ["clarification", "specificity", "implementation"], // Question categories
      required: true
    },
    is_answered: { type: Boolean, default: false, required: true }, // Answer status
    response: { type: String } // Answer text (optional)
  },
  { collection: "follow_up_questions_collection" } // Specify collection name
);

// Create index for efficient queries
followUpQuestionSchema.index({ solution_id: 1 }); // Index on solution_id for finding solution's questions

