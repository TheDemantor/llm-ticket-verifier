// Import Mongoose for schema definitions
import mongoose from "mongoose";
import { initializeOllama } from "../backend/ollamaClient.js";

const { Schema } = mongoose;

/**
 * Problem Schema - Stores IT support problem descriptions
 * Collection: problems_collection
 * 
 * Fields:
 * - problem_id: Unique identifier for linking to solutions/sessions
 * - description: Full problem statement
 * - title: Short problem summary
 * - category: Problem classification (hardware/network/software)
 * - explicit_requirements: Requirements stated in problem
 * - root_cause: Contains cause and summary of root cause
 * - solutions: Array of solutions with solution_id and times_used
 * - created_at: Problem creation timestamp
 */
export const problemSchema = new Schema(
  {
    problem_id: { type: String, required: true },
    description: { type: String, required: true },
    title: { type: String },
    category: { type: String },
    explicit_requirements: [{ type: String }],
    root_cause: {
      cause: { type: String },
      root_cause_summary: { type: String }
    }, 
    solutions: [{ 
      solutions_id: { type: String },
      times_used: { type: Number, default: 1 }
    }],
    created_at: { type: Date, default: Date.now, required: true },
  },
  { collection: "problems_collection" }
);

// Create indexes for efficient queries
problemSchema.index({ problem_id: 1 }, { unique: true }); // Unique index on problem_id
problemSchema.index({ category: 1 }); // Index on category for filtering

/**
 * Solution Schema - Stores IT support solutions
 * Collection: solutions_collection
 * 
 * Fields:
 * - solution_id: Unique solution identifier
 * - problem_id: Links to problem being solved
 * - session_id: Links to chat session that created solution
 * - solution_steps: Detailed implementation steps
 * - claimed_outcomes: Expected results after solution
 * - created_at: Solution save timestamp
 * - verified_by_count: Times users confirmed solution works
 */
export const solutionSchema = new Schema(
  {
    solution_id: { type: String, required: true },
    problem_id: { type: String, required: true },
    session_id: { type: String, required: true },
    solution_steps: [{ type: String, required: true }],
    claimed_outcomes: [{ type: String, required: true }],
    created_at: { type: Date, default: Date.now, required: true },
    verified_by_count: { type: Number, default: 1, required: true }
  },
  { collection: "solutions_collection" }
);

// Create indexes for efficient queries
solutionSchema.index({ solution_id: 1 }, { unique: true }); // Unique index on solution_id
solutionSchema.index({ problem_id: 1 }); // Index on problem_id for finding all solutions

/**
 * Chat Session Schema - Tracks chat conversation sessions
 * Collection: chat_sessions_collection
 * 
 * Fields:
 * - session_id: Unique session identifier
 * - problem_id: Links to problem being discussed
 * - solution_id: Links to solution being worked on
 * - user_id: User who started the session
 * - status: Session state (active/evaluating_solution/improving_solution/sufficient_solution/unsatisfactory_solution/solution_saved/closed)
 * - problem_description: Full problem statement
 * - initialial_solution: User's initial solution
 * - clarifying_questions: Questions asked to improve solution
 * - clarifying_solutions: Improvements/clarifications made
 * - created_at: Session creation timestamp
 */
export const chatSessionSchema = new Schema(
  {
    session_id: { type: String, required: true },
    problem_id: { type: String },
    solution_id: { type: String },
    user_id: { type: String, required: true },
    status: { type: String, enum: ["active", "evaluating_solution", "improving_solution", "sufficient_solution", "unsatisfactory_solution", "solution_saved","closed"], required: true },
    created_at: { type: Date, default: Date.now, required: true },
    problem_description: { type: String }, 
    initial_solution: { type: String },
    clarifying_questions: { type: [String], default: [] },
    clarifying_solutions: { type: [String], default: [] },
  },
  { collection: "chat_sessions_collection" }
);

// Create indexes for efficient queries
chatSessionSchema.index({ session_id: 1 }, { unique: true }); // Unique index on session_id
chatSessionSchema.index({ user_id: 1 }); // Index on user_id for user's sessions
chatSessionSchema.index({ status: 1 }); // Index on status for filtering by status

/**
 * Chat Message Schema - Stores individual chat messages
 * Collection: chat_messages_collection
 * 
 * Fields:
 * - message_id: Unique message identifier
 * - session_id: Links to parent chat session
 * - role: Sender type (user/assistant)
 * - content: Message text
 * - timestamp: Message creation time
 */
export const chatMessageSchema = new Schema(
  {
    message_id: { type: String, required: true },
    session_id: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    message_type: { type: String, enum: ["user_solution", "bot", "response"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, required: true }
  },
  { collection: "chat_messages_collection" }
);

// Create indexes for efficient queries
chatMessageSchema.index({ session_id: 1 }); // Index on session_id for retrieving session messages
chatMessageSchema.index({ timestamp: 1 }); // Index on timestamp for chronological sorting


