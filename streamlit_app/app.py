# Import necessary libraries for the Streamlit app
import streamlit as st
import requests
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure the Streamlit page settings
st.set_page_config(
    page_title="IT Support Data Quality Verifier",
    page_icon="🔍",
    layout="wide"
)

# Set the main title of the app
st.title("IT Support Data Quality Verifier")

# Initialize session state variables for app persistence across reruns
if "session_id" not in st.session_state:
    st.session_state.session_id = None

if "problem_description" not in st.session_state:
    st.session_state.problem_description = None

if "problem_id" not in st.session_state:
    st.session_state.problem_id = None

if "initial_solution" not in st.session_state:
    st.session_state.initial_solution = None
 
if "user_id" not in st.session_state:
    st.session_state.user_id = ""

if "chat_input_enabled" not in st.session_state:
    st.session_state.chat_input_enabled = False
    
if "follow_up_questions" not in st.session_state:
    st.session_state.follow_up_questions = []

if "follow_up_answers" not in st.session_state:
    st.session_state.follow_up_answers = []


if "messages" not in st.session_state:
    st.session_state.messages = []

if "root_cause_analysis" not in st.session_state:
    st.session_state.root_cause_analysis = None
  
if "status" not in st.session_state:
    st.session_state.status = None
    
if "strProblem" not in st.session_state:
    st.session_state.strProblem = None

if "strSolution" not in st.session_state:
    st.session_state.strSolution = None

if "clarifying_cycle" not in st.session_state:
    st.session_state.clarifying_cycle = 0

if "current_question_index_clarifying" not in st.session_state:
    st.session_state.current_question_index_clarifying = 0


# Commented out session state variables (possibly for future use or deprecated)
# if "current_phase" not in st.session_state:
#     st.session_state.current_phase = None

# if "validation_result" not in st.session_state:
#     st.session_state.validation_result = None

# if "validation_status" not in st.session_state:
#     st.session_state.validation_status = None

# if "current_question_index" not in st.session_state:
#     st.session_state.current_question_index = 0


# if "compiled_solution" not in st.session_state:
#     st.session_state.compiled_solution = None

# if "solution_preview_shown" not in st.session_state:
#     st.session_state.solution_preview_shown = False

# if "waiting_confirmation" not in st.session_state:
#     st.session_state.waiting_confirmation = False

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def reset_session():
    """Resets all session state variables to their initial values."""
    st.session_state.session_id = None
    st.session_state.problem_description = ""
    st.session_state.problem_id = None
    st.session_state.user_id = ""
    st.session_state.chat_input_enabled = False
    st.session_state.follow_up_questions = []
    st.session_state.follow_up_answers = []
    st.session_state.messages = []
    st.session_state.root_cause_analysis = None
    st.session_state.initial_solution = None
    st.session_state.status = None
    st.session_state.strProblem = None
    st.session_state.strSolution = None
    st.session_state.clarifying_cycle = 0
    st.session_state.current_question_index_clarifying = 0

def compile_solution_from_conversation():
    """Compiles solution from conversation history. Input: None (uses session_state). Output: dict with solution_details & root_cause_analysis."""
    initial_solution = st.session_state.compiled_solution or ""
    solution_parts = [initial_solution]
    for answer in st.session_state.follow_up_answers:
        solution_parts.append(answer)
    solution_details = "\n\n".join(solution_parts)
    root_cause = "Root cause analysis based on user responses"
    if st.session_state.follow_up_answers:
        root_cause = st.session_state.follow_up_answers[0] if len(st.session_state.follow_up_answers) > 0 else root_cause
    return {
        "solution_details": solution_details,
        "root_cause_analysis": root_cause
    }

def show_solution_preview():
    """Displays formatted solution preview for confirmation. Input: None (uses session_state). Output: Displays in chat, updates session_state.messages."""
    preview_text = f"""**Problem:** {st.session_state.problem_description}

    **Root Cause Analysis:** {st.session_state.root_cause_analysis}

    **Solution:** {st.session_state.compiled_solution}"""
    
    with st.chat_message("assistant"):
        st.markdown("Here's a preview of your solution:")
        st.markdown(preview_text)
        st.markdown("\n**Does this look correct?**")
    
    st.session_state.messages.append({
        "role": "assistant",
        "content": f"Here's a preview of your solution:\n\n{preview_text}\n\n**Does this look correct?**"
    })

def call_backend(endpoint, method="GET", payload=None):
    """Makes HTTP requests to backend API. Input: endpoint (str), method (GET/POST), payload (dict). Output: dict with response or error."""
    try:
        base_url = os.getenv("NODE_SERVER_URL", "https://llm-ticket-verifier.onrender.com")
        url = f"{base_url}{endpoint}"
        if method == "GET":
            print(f"Get {url}")
            response = requests.get(url, timeout=10000)
        elif method == "POST":
            print(f"Post {url}, {payload}")
            response = requests.post(url, json=payload, timeout=10000)
        else:
            return {"error": f"Unsupported method: {method}", "code": "INVALID_METHOD"}
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e), "code": "REQUEST_ERROR"}
    except Exception as e:
        return {"error": str(e), "code": "UNKNOWN_ERROR"}

def save_solution_and_session(clarifying_notes):
    """Saves solution and session to backend when status is sufficient_solution or unsatisfactory_solution.
    Input: clarifying_notes (list or []) from the improvement loop.
    Output: Sets status to 'solution_saved' on success, displays messages."""
    
    with st.chat_message("assistant"):
        with st.spinner("Saving solution..."):
            # Step 1: Save the solution with all details
            save_solution_payload = {
                "session_id": st.session_state.session_id,
                "problem_id": st.session_state.problem_id,
                "strProblem": st.session_state.strProblem,
                "strSolution": st.session_state.strSolution,
                "clarifying_notes": clarifying_notes if clarifying_notes else []
            }
            
            save_solution_result = call_backend(
                "/api/solutions/save",
                method="POST",
                payload=save_solution_payload
            )
    
    if "error" in save_solution_result:
        error_msg = f"❌ Error saving solution: {save_solution_result.get('error', 'Unknown error')}"
        with st.chat_message("assistant"):
            st.markdown(error_msg)
        st.session_state.messages.append({"role": "assistant", "content": error_msg})
    else:
        # Extract solution_id from response
        solution_id = save_solution_result.get("solution_id")
        
        with st.chat_message("assistant"):
            with st.spinner("Saving session data..."):
                # Step 2: Save the session with all metadata
                save_session_payload = {
                    "session_id": st.session_state.session_id,
                    "problem_id": st.session_state.problem_id,
                    "solution_id": solution_id,
                    "problem_description": st.session_state.problem_description,
                    "initial_solution": st.session_state.initial_solution,
                    "clarifying_questions": st.session_state.follow_up_questions,
                    "clarifying_solutions": st.session_state.follow_up_answers
                }
                
                save_session_result = call_backend(
                    "/api/session/save",
                    method="POST",
                    payload=save_session_payload
                )
        
        if "error" in save_session_result:
            error_msg = f"❌ Error saving session: {save_session_result.get('error', 'Unknown error')}"
            with st.chat_message("assistant"):
                st.markdown(error_msg)
            st.session_state.messages.append({"role": "assistant", "content": error_msg})
        else:
            # Success!
            st.session_state.status = "solution_saved"
            st.session_state.chat_input_enabled = False
            
            success_msg = f"✅ **Solution Saved Successfully!**\n\nSolution ID: {solution_id}\n\nThank you for contributing to our knowledge base!"
            with st.chat_message("assistant"):
                st.markdown(success_msg)
            st.session_state.messages.append({"role": "assistant", "content": success_msg})
            st.success("Your solution has been saved! You can reset the session to start a new analysis.")
            st.rerun()

# Sidebar: User info input & session management
with st.sidebar:
    st.header("Problem Analysis")
    user_id = st.text_input("Support Agent Name", value=st.session_state.user_id, key="agent_name_input")
    st.session_state.user_id = user_id
    st.divider()
    problem_description = st.text_area(
        "Describe the technical problem",
        value=st.session_state.problem_description or "",
        height=150,
        key="problem_description_input",
        disabled=st.session_state.session_id is not None
    )
    st.divider()
    # Start Analysis button and logic
    if st.button("Start Analysis", use_container_width=True, disabled=st.session_state.session_id is not None):
        # Validate inputs
        if not user_id:
            st.error("Please enter your Support Agent Name")
        elif not problem_description.strip():
            st.error("Please describe the technical problem")
        else:
            # Call backend to start analysis
            with st.spinner("Starting analysis..."):
                st.session_state.user_id = user_id
                st.session_state.problem_description = problem_description.strip()
                result = call_backend("/api/chat/start", method="POST", payload={"user_id": user_id})
                structuredProblemResponse = call_backend("/api/structure/problem", method="POST", payload={"problemDesc": problem_description.strip()})
                structuredProblem = structuredProblemResponse.get("structured_problem", {})
                explicit_requirements=structuredProblem.get('explicit_requirements', [])
                print("Structured Problem Response:", structuredProblemResponse)
            # Check for errors in both API calls
            if "error" in result:
                st.error(f"❌ Error starting chat: {result.get('error', 'Unknown error')}")
                st.warning("Click 'Reset Session' in the sidebar to try again.")
            elif "error" in structuredProblem or len(explicit_requirements) == 0:
                st.error(f"❌ Error structuring problem: {structuredProblem.get('error', 'Unknown error')}")
                st.warning("Click 'Reset Session' in the sidebar to try again.")
                
            else:
                # Update session state with response data
                st.session_state.session_id = result.get("session_id")
                st.session_state.problem_id = structuredProblemResponse.get("problem_id")
                
                st.session_state.status = "active"
                st.session_state.strProblem = structuredProblem  # Store structured problem
                ai_message = f"How did you solve this problem?\n\n{problem_description.strip()}"
                st.session_state.messages.append({"role": "assistant", "content": ai_message})
                st.success("Analysis started! Check the chat area.")
                st.rerun()
    
    # Reset session button and logic
    if st.session_state.session_id:
        st.divider()
        if st.button("Reset Session", use_container_width=True):
            reset_session()
            st.rerun()

# Chat interface: Display messages & handle user input
st.header("Chat Interface")
# Display existing messages in the chat
if st.session_state.messages:
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
else:
    st.info("👋 Enter your details in the sidebar and click 'Start Analysis' to begin.")

# # Enable chat input on button click
if st.session_state.status == "active" and not st.session_state.chat_input_enabled:
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        if st.button("Describe My Solution", use_container_width=True, type="primary"):
            st.session_state.chat_input_enabled = True
            st.rerun()

# # Set placeholder text for chat input based on state
chat_placeholder = "Type your message here..." if st.session_state.chat_input_enabled else "Click 'Describe My Solution' to enable chat input"

# # Handle user input from chat
if prompt := st.chat_input(chat_placeholder, disabled=not st.session_state.chat_input_enabled):
    # Add user message to session state and display it
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)
    
    if st.session_state.session_id and st.session_state.status == "active":
        problem_id = st.session_state.problem_id
        print("Current Problem ID:", st.session_state.problem_id)
        print(st.session_state)
        # Check if problem_id exists
        if not problem_id:
            error_msg = "❌ Error: Problem ID not found. Please restart the analysis."
            with st.chat_message("assistant"):
                st.markdown(error_msg)
                st.warning("Click 'Reset Session' in the sidebar to try again.")
            st.session_state.messages.append({"role": "assistant", "content": error_msg})
        else:
            # Validate the user's solution via backend
            with st.chat_message("assistant"):
                # call backend API to structurize the solution "/api/structure/solution"
                with st.spinner("Structuring your solution..."):
                    st.session_state.initial_solution = prompt
                    structured_solution = call_backend("/api/structure/solution", method="POST", payload={"solutionDesc": prompt})
                if "error" in structured_solution:
                    error_msg = f"❌ Error structuring solution: {structured_solution.get('error', 'Unknown error')}"
                    st.warning(error_msg)
                else:
                    # save the structurized solution in session state for later use
                    st.session_state.strSolution = structured_solution.get("structured_solution", "")
                # call backend API to validate the solution by passing strProblem, strSolution from session state
                with st.spinner("Validating your solution..."):
                    st.session_state.status = "evaluating_solution"
                    validation_result = call_backend("/api/solutions/validate", method="POST", payload={"strProblem": st.session_state.strProblem, "strSolution": st.session_state.strSolution})
                if "error" in validation_result:
                    error_msg = f"❌ Error validating solution: {validation_result.get('error', 'Unknown error')}"
                    st.markdown(error_msg)
                    st.warning("Click 'Reset Session' in the sidebar to start over.")
                    st.session_state.messages.append({"role": "assistant", "content": error_msg})
                else:
                    # Process validation result
                    print("Validation Result:", validation_result)
                    validation_data = validation_result.get("evaluation_result", {})
                    # st.session_state.validation_result = validation_data
                    clarifying_questions = validation_data.get("clarifying_questions", [])
                    verdict = validation_data.get("verdict", "unknown")
                    coverage_score = validation_data.get("coverage_score", 0)
                    
                    st.session_state.status = "sufficient_solution" if coverage_score >= 80 else "improving_solution"
                    
                    # ===================================================================
                    # STEP 6A: Ask clarifying questions if coverage < 80%
                    # ===================================================================
                    if st.session_state.status == "improving_solution":
                        # Store clarifying questions for first cycle
                        st.session_state.follow_up_questions.extend(clarifying_questions)
                        st.session_state.clarifying_cycle = 1
                        st.session_state.current_question_index_clarifying = 0
                        st.session_state.expecting_clarification_answer = True
                        
                        # Ask the first clarifying question
                        if len(st.session_state.follow_up_questions) > 0:
                            first_q = st.session_state.follow_up_questions[0]
                            with st.chat_message("assistant"):
                                st.markdown(f"**Clarification {st.session_state.clarifying_cycle}.1:** {first_q}")
                            st.session_state.messages.append({"role": "assistant", "content": first_q})
                            st.rerun()
                    
                    # ===================================================================
                    # STEP 7: Save Solution (If Coverage ≥ 80%)
                    # ===================================================================
                    if st.session_state.status == "sufficient_solution":
                        save_solution_and_session(clarifying_notes=[])

    
    # ===================================================================
    # SECTION B: CLARIFICATION ANSWER LOOP (status == "awaiting_clarification")
    # Handles user answers to clarifying questions across multiple cycles
    # ===================================================================
    if st.session_state.get("expecting_clarification_answer", False) or st.session_state.status == "improving_solution":
        # Store the user's clarification answer
        st.session_state.follow_up_answers.append(prompt)
        st.session_state.expecting_clarification_answer = False
        
        # Move to next question index
        st.session_state.current_question_index_clarifying += 1
        
        # Check if there are more questions in the current batch to ask
        if st.session_state.current_question_index_clarifying < len(st.session_state.follow_up_questions):
            idx = st.session_state.current_question_index_clarifying
            next_q = st.session_state.follow_up_questions[idx]
            with st.chat_message("assistant"):
                st.markdown(f"**Clarification {st.session_state.clarifying_cycle}.{idx + 1}:** {next_q}")
            st.session_state.messages.append({"role": "assistant", "content": next_q})
            st.session_state.expecting_clarification_answer = True
            st.rerun()
        
        # All current questions answered — generate notes and re-validate
        else:
            cycle_count = st.session_state.clarifying_cycle
            max_cycles = 3
            
            # Step 3: Generate clarifying notes
            with st.chat_message("assistant"):
                with st.spinner(f"Processing clarifications (Cycle {cycle_count}/{max_cycles})..."):
                    notes_result = call_backend(
                        "/api/generate/notes",
                        method="POST",
                        payload={
                            "questionsArray": st.session_state.follow_up_questions,
                            "answersArray": st.session_state.follow_up_answers
                        }
                    )
            
            if "error" in notes_result:
                error_msg = f"❌ Error generating notes: {notes_result.get('error', 'Unknown error')}"
                with st.chat_message("assistant"):
                    st.markdown(error_msg)
                st.session_state.messages.append({"role": "assistant", "content": error_msg})
                st.session_state.status = "active"  # Reset to allow retry
                st.rerun()
            
            clarifying_notes = notes_result.get("clarifying_notes", [])
            
            # Step 4: Re-evaluate solution with clarifying notes
            with st.chat_message("assistant"):
                with st.spinner(f"Re-validating solution with clarifications (Cycle {cycle_count}/{max_cycles})..."):
                    revalidation_result = call_backend(
                        "/api/solutions/validate",
                        method="POST",
                        payload={
                            "strProblem": st.session_state.strProblem,
                            "strSolution": st.session_state.strSolution,
                            "clarifyingNotes": clarifying_notes
                        }
                    )
            
            if "error" in revalidation_result:
                error_msg = f"❌ Error re-validating solution: {revalidation_result.get('error', 'Unknown error')}"
                with st.chat_message("assistant"):
                    st.markdown(error_msg)
                st.session_state.messages.append({"role": "assistant", "content": error_msg})
                st.session_state.status = "active"
                st.rerun()
            
            revalidation_data = revalidation_result.get("evaluation_result", {})
            new_coverage_score = revalidation_data.get("coverage_score", 0)
            new_clarifying_questions = revalidation_data.get("clarifying_questions", [])
            
            # Step 5: Update state or iterate
            if new_coverage_score >= 80:
                st.session_state.status = "sufficient_solution"
                with st.chat_message("assistant"):
                    st.markdown(f"✅ **Solution Improvement Successful!** Coverage score improved to {new_coverage_score}%")
                st.session_state.messages.append({"role": "assistant", "content": f"✅ Coverage {new_coverage_score}%"})
                # Save solution and session
                save_solution_and_session(clarifying_notes=clarifying_notes)
            
            elif cycle_count >= max_cycles:
                # Max cycles exhausted
                st.session_state.status = "unsatisfactory_solution"
                with st.chat_message("assistant"):
                    st.markdown(f"⚠️ **Maximum clarification cycles reached.** Current coverage: {new_coverage_score}%. Marking as unsatisfactory.")
                st.session_state.messages.append({"role": "assistant", "content": f"⚠️ Max cycles reached. Coverage: {new_coverage_score}%"})
                # Save solution and session with unsatisfactory status
                save_solution_and_session(clarifying_notes=clarifying_notes)
            
            else:
                # Continue to next cycle with new questions
                st.session_state.clarifying_cycle += 1
                st.session_state.follow_up_questions.extend(new_clarifying_questions)
                st.session_state.current_question_index_clarifying = len(st.session_state.follow_up_questions) - len(new_clarifying_questions)
                
                
                # Ask the first question of next cycle
                if st.session_state.current_question_index_clarifying < len(st.session_state.follow_up_questions):
                    next_idx = st.session_state.current_question_index_clarifying
                    next_q = st.session_state.follow_up_questions[next_idx]
                    with st.chat_message("assistant"):
                        st.markdown(f"**Clarification {st.session_state.clarifying_cycle}.1:** {next_q}")
                    st.session_state.messages.append({"role": "assistant", "content": next_q})
                    st.session_state.expecting_clarification_answer = True
                    st.rerun()

                                        
            # ===================================================================
            # PHASE 4: SAVE SOLUTION AND SESSION
            # ===================================================================
            if st.session_state.status == "sufficient_solution" or st.session_state.status == "unsatisfactory_solution":
                save_solution_and_session(clarifying_notes=[])

    
#     # Phase 3: Follow-Up Questions - Input: follow-up answers, Output: compiled solution & confirmation
#     elif st.session_state.current_phase == "followups":
#         status = st.session_state.validation_status
        
#         # Follow-up Path 1: Matched solution confirmation
#         # Follow-up Path 1: Matched solution confirmation
#         if status == "matches_existing" and st.session_state.current_question_index == -2:
#             # Check user confirmation
#             user_response_lower = prompt.lower().strip()
#             if "yes" in user_response_lower or "yep" in user_response_lower or "correct" in user_response_lower or "right" in user_response_lower:
#                 # Save the solution as it matches existing
#                 with st.chat_message("assistant"):
#                     with st.spinner("Saving solution..."):
#                         save_result = call_backend("/api/solutions/save", method="POST", payload={"session_id": st.session_state.session_id, "problem_description": st.session_state.problem_description, "root_cause_analysis": "Verified match with existing solution", "solution_details": st.session_state.compiled_solution})
#                     if "error" in save_result:
#                         error_msg = f"Error saving solution: {save_result.get('error', 'Unknown error')}"
#                         st.markdown(error_msg)
#                         st.warning("Click 'Reset Session' in the sidebar to start over.")
#                         st.session_state.messages.append({"role": "assistant", "content": error_msg})
#                     else:
#                         st.markdown("Solution saved!")
#                         st.session_state.messages.append({"role": "assistant", "content": "Solution saved!"})
#                         st.session_state.current_phase = "completed"
#                         st.session_state.chat_input_enabled = False
#             else:
#                 # User says no, ask for differences
#                 with st.chat_message("assistant"):
#                     st.markdown("What were the key differences in your approach?")
#                 st.session_state.messages.append({"role": "assistant", "content": "What were the key differences in your approach?"})
#                 st.session_state.current_question_index = 0
#                 st.session_state.follow_up_questions = ["What specific steps differed from the existing solution?", "Were there any additional considerations?", "What made your approach unique?"]
#                 st.rerun()
        
#         # Follow-up Path 2: New/Generic solution questions
#                 st.rerun()
        
#         # Follow-up Path 2: New/Generic solution questions
#         elif status in ["new_solution", "too_generic"]:
#             # Handle follow-up questions
#             if st.session_state.current_question_index < len(st.session_state.follow_up_questions):
#                 # Store answer and ask next question
#                 st.session_state.follow_up_answers.append(prompt)
#                 if st.session_state.current_question_index < len(st.session_state.follow_up_questions) - 1:
#                     st.session_state.current_question_index += 1
#                     next_question = st.session_state.follow_up_questions[st.session_state.current_question_index]
#                     with st.chat_message("assistant"):
#                         st.markdown(next_question)
#                     st.session_state.messages.append({"role": "assistant", "content": next_question})
#                 else:
#                     # All questions answered, compile and show preview
#                     st.session_state.current_question_index += 1
#                     compiled = compile_solution_from_conversation()
#                     st.session_state.compiled_solution = compiled["solution_details"]
#                     st.session_state.root_cause_analysis = compiled["root_cause_analysis"]
#                     show_solution_preview()
#                     st.session_state.solution_preview_shown = True
#                     st.session_state.waiting_confirmation = True
#             else:
#                 # Handle confirmation of the compiled solution
#                 if st.session_state.waiting_confirmation:
#                     user_response_lower = prompt.lower().strip()
#                     if "yes" in user_response_lower or "correct" in user_response_lower or "looks good" in user_response_lower:
#                         # Save the solution
#                         with st.chat_message("assistant"):
#                             with st.spinner("Saving solution..."):
#                                 save_result = call_backend("/api/solutions/save", method="POST", payload={"session_id": st.session_state.session_id, "problem_description": st.session_state.problem_description, "root_cause_analysis": st.session_state.root_cause_analysis, "solution_details": st.session_state.compiled_solution})
#                             if "error" in save_result:
#                                 error_msg = f"Error saving solution: {save_result.get('error', 'Unknown error')}"
#                                 st.markdown(error_msg)
#                                 st.warning("Click 'Reset Session' in the sidebar to start over.")
#                                 st.session_state.messages.append({"role": "assistant", "content": error_msg})
#                             else:
#                                 st.markdown("Solution saved!")
#                                 st.session_state.messages.append({"role": "assistant", "content": "Solution saved!"})
#                                 st.session_state.current_phase = "completed"
#                                 st.session_state.chat_input_enabled = False
#                     else:
#                         # Ask for changes
#                         with st.chat_message("assistant"):
#                             st.markdown("What would you like to change?")
#                         st.session_state.messages.append({"role": "assistant", "content": "What would you like to change?"})
#                         st.session_state.waiting_confirmation = False
    
#     # Rerun the app to update the UI after changes
#     st.rerun()
