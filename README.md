# NVIAM CODE - Backend

Robust Backend for NVIAM IDE, powered by Node.js, Express, and Socket.IO.

## 🚀 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.IO
- **AI**: Google Gemini Pro (Generative AI)
- **Deployment**: Railway / Render

## 🛠️ Local Development

1.  **Install Dependencies**

    ```bash
    npm install
    ```

2.  **Environment Setup**
    Copy `.env.example` to `.env`:

    ```bash
    cp .env.example .env
    ```

    Set your variables:

    - `PORT`: `3000`
    - `MONGO_URI`: Your MongoDB Connection String.
    - `JWT_SECRET`: Secret for Authentication.
    - `GOOGLE_AI_KEY`: Gemini API Key.
    - `FRONTEND_URL`: `http://localhost:5173` (for local) or `https://your-app.vercel.app` (for prod).

3.  **Start Server**
    ```bash
    npm run dev
    ```

## ☁️ Deployment (Render/Railway)

### 1. Database Setup (Crucial)

You cannot use `localhost` for the database on Production. You need a Cloud Database.
**Option A: MongoDB Atlas (Recommended)**

1.  Create a free account on [MongoDB Atlas](https://www.mongodb.com/atlas).
2.  Create a Cluster -> Database Access (Create User) -> Network Access (Allow IP `0.0.0.0/0`).
3.  Get the **Connection String** (e.g., `mongodb+srv://user:pass@cluster...`).

### 2. Deploy Backend

1.  **Import Project**: Select the `backend` folder as the root directory.
2.  **Variables**: Add these variables in Dashboard:
    - `MONGO_URI`: **Paste your Cloud Connection String here.**
    - `JWT_SECRET`: Any secure random string.
    - `GOOGLE_AI_KEY`: Your Gemini API Key.
    - `FRONTEND_URL`: **YOUR VERCEL APP URL** (e.g., `https://my-app.vercel.app`) - **Required for CORS**.
3.  **Deploy**: Platform will start the server.

### 3. Frontend Connection

Ensure your Frontend connects to this Backend URL.

## 📄 Maintained by NVIAM
