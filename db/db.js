import mongoose from 'mongoose';

export async function connect() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!uri) {
        throw new Error('Missing MongoDB connection string. Set MONGO_URI or MONGODB_URI.');
    }

    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000
    });

    console.log('Connected to MongoDB');
}

export default connect;
