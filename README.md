# IT Support Data Quality Verifier (DQMS)

An intelligent system for validating and improving IT support solution quality using local LLM technology (Ollama). This project helps IT teams ensure solutions are accurate, complete, and maintain consistency with historical solutions.

**This is an open-source project and we welcome contributions from everyone!** 🎉

## 🎯 Features

- **Problem Analysis**: Analyzes IT support problems and finds similar historical cases for context
- **Solution Validation**: Evaluates user-provided solutions for technical accuracy and completeness
- **Intelligent Follow-ups**: Generates contextual follow-up questions to clarify and improve solutions
- **Solution Comparison**: Validates new solutions against historical solutions to detect duplicates
- **Solution Formatting**: Structures solutions into professional documentation
- **Chat Session Management**: Maintains session state and conversation history for seamless interactions

## 🏗️ Project Structure

```
.
├── backend/                      # Node.js API server
│   ├── server.js                # Express API endpoints
│   ├── chatHandler.js           # Chat flow logic
│   ├── ollamaClient.js          # LLM integration with Ollama
│   ├── testFlow.js              # Test flow script
│   └── testOllama.js            # Ollama connection test
├── streamlit_app/
│   └── app.py                   # User interface (Streamlit)
├── database/
│   └── db.js                    # MongoDB database operations
├── models/
│   └── schemas.js               # Mongoose schemas for data models
├── config/                      # Configuration files
├── DQMS_API.postman_collection.json  # API documentation (Postman)
├── package.json                 # Node.js dependencies
├── requirements.txt             # Python dependencies
└── .env                         # Environment variables (not in git)
```

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **LLM**: Ollama (local)
- **API**: RESTful endpoints
- **Utilities**: UUID for session management

### Frontend
- **Framework**: Streamlit (Python)
- **HTTP Client**: Requests library
- **State Management**: Streamlit session state

## 📋 Prerequisites

Before running the project, ensure you have:

- **Node.js** (v14 or higher)
- **Python** (v3.8 or higher)
- **MongoDB** (local or remote)
- **Ollama** (with llama3.2 model installed)

### Ollama Setup

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull the required model:
   ```bash
   ollama pull llama3.2
   ```
3. Start Ollama service (typically runs on `http://localhost:11434`)

## 🚀 Installation

### Backend Setup

1. Navigate to the project directory:
   ```bash
   cd dqms
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root:
   ```bash
   # Ollama Configuration
   OLLAMA_API_URL=http://localhost:11434
   
   # Express Server
   PORT=3000
   
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/dqms
   ```

### Frontend Setup

1. Create a Python virtual environment:
   ```bash
   python -m venv venv
   ```

2. Activate the virtual environment:
   - **Windows**:
     ```bash
     venv\Scripts\activate
     ```
   - **macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```

3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## 🎮 Running the Application

### Start MongoDB (if local)
```bash
mongod
```

### Start Ollama Service
```bash
ollama serve
```

### Start Backend API Server

**Development mode** (with auto-reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

The API server will be available at `http://localhost:3000`

### Start Frontend

In a new terminal:
```bash
cd streamlit_app
streamlit run app.py
```

The web interface will be available at `http://localhost:8501`

## 📚 API Endpoints

### Chat Operations

- **`POST /api/chat/start`**
  - Initiates a new chat session with a problem description
  - Request: `{ user_id, problem_description }`
  - Response: `{ session_id, ai_response, problem_id }`

- **`POST /api/chat/message`**
  - Sends a message in an existing chat session
  - Request: `{ session_id, user_message, message_type }`
  - Response: `{ response_text, next_action, follow_up_questions?, session_updated }`

- **`GET /api/chat/:session_id/history`**
  - Retrieves chat history for a session
  - Response: Array of messages with role and content

## 🔄 Chat Flow

1. **Problem Description Phase**: User describes the IT support problem
2. **Follow-up Questions**: System asks clarifying questions
3. **Solution Phase**: User provides their solution
4. **Solution Validation**: System validates the solution against:
   - Technical accuracy and completeness
   - Historical solutions for duplicates
5. **Solution Formatting**: System structures the solution professionally

## 🧠 Available LLM Functions

The `ollamaClient.js` module provides:

- `initializeOllama()` - Verify Ollama connection
- `analyzeProblem()` - Analyze problems with context from similar past issues
- `analyzeUserSolution()` - Evaluate solution quality
- `generateFollowUpQuestions()` - Generate 3 contextual follow-up questions
- `validateSolutionAgainstOld()` - Check for duplicate/similar solutions
- `formatSolutionStructure()` - Format solution into professional documentation

## 📦 Database Schema

The MongoDB database stores:

- **Problems**: Problem descriptions and metadata
- **Solutions**: Solution details linked to problems
- **Chat Sessions**: Session state and conversation history
- **Messages**: Individual chat messages with role and content

## 🧪 Testing

Run the flow test to verify setup:
```bash
npm run test:flow
```

Test Ollama connection:
```bash
node backend/testOllama.js
```

## 🔐 Environment Variables

Key environment variables in `.env`:

```bash
# Ollama API Configuration
OLLAMA_API_URL=http://localhost:11434

# Express Server Port
PORT=3000

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/dqms

# Optional: Custom model name (defaults to llama3.2)
# MODEL_NAME=llama3.2
```

## 📖 API Documentation

For detailed API specifications, import `DQMS_API.postman_collection.json` into Postman to explore all endpoints with examples.

## 🐛 Troubleshooting

### Ollama Connection Issues
- Verify Ollama is running: `ollama serve`
- Check `OLLAMA_API_URL` in `.env` matches your Ollama instance
- Ensure `llama3.2` model is installed: `ollama pull llama3.2`

### MongoDB Connection Issues
- Verify MongoDB is running locally or update `MONGODB_URI` with remote connection
- Check database name in connection string matches your setup

### Streamlit Port Conflict
- Streamlit default port is 8501. If in use, specify: `streamlit run app.py --server.port 8502`

### CORS Issues
- Backend CORS is configured for `http://localhost:8501`
- Update `server.js` if frontend runs on different port

## 🤝 Contributing

We love contributions! This project is open source and everyone is welcome to contribute. Whether you're fixing bugs, adding features, improving documentation, or sharing ideas, your help makes this project better.

### How to Contribute (Easy & Simple!)

1. **Fork the Repository**
   - Click the "Fork" button on GitHub to create your own copy

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**
   - Work on your feature, fix, or improvement
   - Keep commits clear and descriptive

4. **Test Your Changes**
   - Test locally to ensure everything works
   - Run existing tests if available

5. **Push and Submit a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```
   - Go to GitHub and create a pull request
   - Describe your changes clearly

### Ways to Contribute

- 🐛 **Report Bugs**: Found an issue? Open a GitHub issue
- ✨ **Add Features**: Have a great idea? Submit a pull request
- 📖 **Improve Docs**: Help improve documentation and README
- 🧪 **Add Tests**: Enhance test coverage
- 💡 **Suggest Ideas**: Share your thoughts in discussions/issues
- 🌍 **Translations**: Help translate the project

### No Experience Needed!

- First time contributing? That's okay! Start small
- Questions? Ask in the pull request or issues
- We're here to help and support you

## 📝 License

This project is open source. See LICENSE file for details.

## 👥 Contributors

We appreciate all contributors! Your contributions help make this project better for everyone.

## 📧 Support

- **Found a bug?** Open an [issue](https://github.com/TheDemantor/llm-ticket-verifier/issues)
- **Have a question?** Ask in the [discussions](https://github.com/TheDemantor/llm-ticket-verifier/discussions)
- **Want to contribute?** See the [Contributing](#-contributing) section above
