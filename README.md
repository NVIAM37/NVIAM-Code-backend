# NVIAM CODE - Backend

Robust Backend for NVIAM IDE, powered by Node.js, Express, and Socket.IO.

## 🚀 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.IO
- **AI**: Google Gemini Pro (Generative AI)
- **Deployment**: Railway

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

3.  **Start Server**
    ```bash
    npm run dev
    ```

## ☁️ Deployment (Railway)

### 1. Database Setup (Crucial)

You cannot use `localhost` for the database on Railway. You need a Cloud Database.
**Option A: MongoDB Atlas (Recommended)**

1.  Create a free account on [MongoDB Atlas](https://www.mongodb.com/atlas).
2.  Create a Cluster -> Database Access (Create User) -> Network Access (Allow IP `0.0.0.0/0`).
3.  Get the **Connection String** (e.g., `mongodb+srv://user:pass@cluster...`).

**Option B: Railway MongoDB Plugin**

1.  In your Railway project, right-click -> Add Service -> Database -> MongoDB.
2.  Railway will provide a `MONGO_URL` variable automatically.

### 2. Deploy Backend

1.  **Import Project**: Select the `backend` folder as the root directory.
2.  **Variables**: Add these variables in Railway:
    - `MONGO_URI`: **Paste your Cloud Connection String here.**
    - `JWT_SECRET`: Any secure random string.
    - `GOOGLE_AI_KEY`: Your Gemini API Key.
3.  **Deploy**: Railway will start the server.

## 📄 Maintained by NVIAM
