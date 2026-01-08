import mongoose from "mongoose";


function connect() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error("❌ Error: MONGO_URI is not defined in .env file");
        return;
    }
    mongoose.connect(uri)
        .then(() => {
            console.log("Connected to MongoDB");
        })
        .catch(err => {
            console.error("❌ Failed to connect to MongoDB:", err.message);
            // On a Cloud platform, if DB fails, we should restart/crash to signal health check failure
            process.exit(1);
        })
}

export default connect;