import {
  getChatSession,
  getChatMessages,
  addChatMessage,
  getSolutionsByProblemId,
  findSimilarProblems,
  getProblem
} from "../database/db.js";
import {
  analyzeProblem,
  generateFollowUpQuestions,
  validateSolutionAgainstOld
} from "./ollamaClient.js";
/**
 * Processes user messages based on message type and conversation flow state
 * Implements complete chat flow logic with different behaviors per phase
 * @param {string} session_id - Session ID
 * @param {string} user_message - User's message content
 * @param {string} message_type - Type: "problem_description" | "solution" | "follow_up_answer"
 * @returns {Promise<{response_text: string, next_action: string, follow_up_questions?: string[], session_updated: boolean}>}
 */
export async function processUserMessage(session_id, user_message, message_type) {
  try {
    // Fetch session context from MongoDB to get current state
    const session = await getChatSession(session_id);
    if (!session) {
      throw new Error("Session not found");
    }

    // Get full chat history to determine flow state and context
    const messages = await getChatMessages(session_id);
    // Filter to get only user messages for counting
    const userMessages = messages.filter(msg => msg.role === "user");
    // Calculate message count including current message
    const messageCount = userMessages.length + 1; // +1 for current message

    // Save user message to database immediately
    await addChatMessage({
      session_id: session_id,
      role: "user",
      content: user_message
    });

    // Initialize response variables
    let response_text = "";
    let next_action = "ask_followup";  // Default action
    let follow_up_questions = [];
    let session_updated = false;

    // ========================================================================
    // FLOW LOGIC - Different behavior based on message_type
    // ========================================================================
    
    if (message_type === "problem_description") {
      // Message 1: User provides problem description
      // Analyze problem and return clarifying questions
      
      // Find similar problems from database for LLM context
      const similarProblems = await findSimilarProblems(user_message, 5);
      
      // Analyze problem using Ollama with similar problems as context
      // LLM uses context internally but returns simple question
      const analysisResult = await analyzeProblem(user_message, similarProblems);
      response_text = analysisResult.ai_response;

      // Generate initial clarifying questions to better understand problem
      const problem = await getProblem(session.problem_id);
      const problemDesc = problem?.description || user_message;
      
      try {
        // Use Ollama to generate follow-up questions
        const questionsResult = await generateFollowUpQuestions(
          "Initial problem analysis",
          problemDesc
        );
        follow_up_questions = questionsResult.questions || [];
      } catch (error) {
        // Fallback questions if LLM generation fails
        follow_up_questions = [
          "Can you provide more details about when this issue occurs?",
          "What environment or system is affected?",
          "Have you tried any troubleshooting steps already?"
        ];
      }

      next_action = "ask_followup";
      session_updated = true;

    } else if (message_type === "follow_up_answer") {
      // Messages 2-3 or 5-N: User is answering follow-up questions
      // Different behavior based on message count
      
      if (messageCount <= 3) {
        // Messages 2-3: Early phase - refine understanding of problem
        const problem = await getProblem(session.problem_id);
        const problemDesc = problem?.description || "Technical issue";
        
        // Get recent conversation context for LLM
        // Use last 4 messages to understand conversation flow
        const conversationContext = messages
          .slice(-4) // Last 4 messages for context
          .map(msg => `${msg.role}: ${msg.content}`)
          .join("\n");

        try {
          // Generate follow-up questions to refine understanding
          const questionsResult = await generateFollowUpQuestions(
            conversationContext,
            problemDesc
          );
          follow_up_questions = questionsResult.questions || [];
          
          if (messageCount === 3) {
            // After 3rd message, transition to asking for solution
            // User has provided enough problem details
            response_text = "Thank you for the details. Now, how did you solve this problem?";
            next_action = "ask_followup";
            follow_up_questions = []; // No more questions, waiting for solution
          } else {
            // Continue asking questions
            response_text = "I understand. Let me ask a few more questions to better understand the situation.";
            next_action = "ask_followup";
          }
        } catch (error) {
          // Fallback if question generation fails
          if (messageCount === 3) {
            response_text = "Thank you for the details. Now, how did you solve this problem?";
            next_action = "ask_followup";
          } else {
            response_text = "I understand. Can you provide more details?";
            next_action = "ask_followup";
            // Use default fallback questions
            follow_up_questions = [
              "What was the root cause?",
              "What steps did you take?",
              "Were there any specific configurations needed?"
            ];
          }
        }
      } else {
        // Messages 5-N: Later phase - ask targeted questions based on validation
        // Check validation status from session (if stored)
        const validationStatus = session.validation_status || null;
        
        if (validationStatus === "matches_existing") {
          // Ask about differences
          response_text = "I see your solution matches existing ones. What were the key differences in your approach?";
          next_action = "ask_followup";
          follow_up_questions = [
            "What specific steps differed?",
            "Were there any unique considerations?",
            "What made your approach different?"
          ];
        } else if (validationStatus === "new_solution" || validationStatus === "too_generic") {
          // Ask targeted questions to improve solution details
          const problem = await getProblem(session.problem_id);
          const problemDesc = problem?.description || "Technical issue";
          
          // Get the solution from conversation
          const solutionMessages = messages.filter(msg => 
            msg.role === "user" && messages.indexOf(msg) >= 3
          );
          const currentSolution = solutionMessages.map(msg => msg.content).join("\n") || user_message;

          try {
            const questionsResult = await generateFollowUpQuestions(
              currentSolution,
              problemDesc
            );
            follow_up_questions = questionsResult.questions || [];
            response_text = "To help improve the solution documentation, I have a few more questions:";
            next_action = "ask_followup";
          } catch (error) {
            response_text = "Can you provide more specific details about your solution?";
            next_action = "ask_followup";
            follow_up_questions = [
              "What was the root cause analysis?",
              "What were the exact steps taken?",
              "Were there any prerequisites or dependencies?"
            ];
          }
        } else {
          // Default: continue asking questions
          response_text = "Thank you for that information. Do you have any additional details to share?";
          next_action = "ask_followup";
        }
      }

      session_updated = true;

    } else if (message_type === "solution") {
      // Message 4: Validate solution, return validation status
      const problem = await getProblem(session.problem_id);
      if (!problem) {
        throw new Error("Problem not found");
      }

      // Get existing solutions for this problem
      const existingSolutions = await getSolutionsByProblemId(problem.problem_id);
      
      if (existingSolutions.length === 0) {
        // No existing solutions - new solution
        response_text = "This appears to be a novel solution. Can you provide more details?";
        next_action = "ask_followup";
        follow_up_questions = [
          "What was the root cause of this problem?",
          "Can you describe the specific steps you took to resolve it?",
          "Were there any prerequisites or dependencies needed?"
        ];
        session_updated = true;
      } else {
        // Extract solution texts for comparison
        const oldSolutionsTexts = existingSolutions.map(sol => 
          `${sol.root_cause_analysis}\n${sol.solution_details}`
        );

        // Validate against old solutions
        const validationResult = await validateSolutionAgainstOld(
          user_message,
          oldSolutionsTexts
        );

        // Determine status and response
        const matchPercentage = validationResult.matchPercentage || 0;
        const matches = validationResult.matches || false;

        if (matches && matchPercentage >= 80) {
          // Matches existing
          response_text = `Your solution matches ${existingSolutions.length} existing solution(s) with ${matchPercentage}% confidence. Is this the approach you took?`;
          next_action = "validate_solution";
          session_updated = true;
        } else if (matchPercentage < 30) {
          // Too generic
          response_text = "Your solution is quite general. Can you be more specific about the steps you took?";
          next_action = "ask_for_details";
          follow_up_questions = [
            "What specific steps did you follow?",
            "What tools or commands did you use?",
            "Were there any specific configurations or settings?"
          ];
          session_updated = true;
        } else {
          // New solution (partial match)
          response_text = "This appears to be a novel solution. Can you provide more details?";
          next_action = "ask_for_details";
          follow_up_questions = [
            "What was the root cause of this problem?",
            "Can you describe the specific steps you took to resolve it?",
            "Were there any prerequisites or dependencies needed?"
          ];
          session_updated = true;
        }
      }
    }

    // Save assistant's response to database for chat history
    await addChatMessage({
      session_id: session_id,
      role: "assistant",
      content: response_text
    });

    // Build response object with required fields
    const response = {
      response_text: response_text,  // AI's response text
      next_action: next_action,      // Next action: "ask_followup" | "validate_solution" | "ask_for_details"
      session_updated: session_updated  // Whether session state was updated
    };

    // Add follow-up questions if any were generated
    if (follow_up_questions && follow_up_questions.length > 0) {
      response.follow_up_questions = follow_up_questions;
    }

    // Return structured response
    return response;

  } catch (error) {
    throw new Error(`Failed to process user message: ${error.message}`);
  }
}

