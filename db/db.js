import mongoose from 'mongoose';

let mongoReady = false;
let mongoLastError = null;

function setMongoReady(value) {
    mongoReady = value;
}

function setMongoLastError(error) {
    mongoLastError = error ?? null;
}

export function getDbStatus() {
    return {
        ready: mongoReady && mongoose.connection.readyState === 1,
        state: mongoose.connection.readyState,
        error: mongoLastError ? mongoLastError.message : null
    };
}

export function requireDatabase(req, res, next) {
    const status = getDbStatus();

    if (!status.ready) {
        return res.status(503).json({
            error: 'Database unavailable',
            details: status.error || 'MongoDB is not connected'
        });
    }

    next();
}

export async function connect() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!uri) {
        const error = new Error('Missing MongoDB connection string. Set MONGO_URI or MONGODB_URI.');
        setMongoReady(false);
        setMongoLastError(error);
        throw error;
    }

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000
        });

        setMongoReady(true);
        setMongoLastError(null);
        console.log('Connected to MongoDB');
    } catch (error) {
        setMongoReady(false);
        setMongoLastError(error);
        console.error('MongoDB connection failed:', error);
        throw error;
    }
}

mongoose.connection.on('connected', () => {
    setMongoReady(true);
    setMongoLastError(null);
});

mongoose.connection.on('disconnected', () => {
    setMongoReady(false);
    console.error('MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
    setMongoReady(false);
    setMongoLastError(error);
    console.error('MongoDB connection error:', error);
});

export default connect;
