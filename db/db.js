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
            console.log(err);
        })
}

export default connect;