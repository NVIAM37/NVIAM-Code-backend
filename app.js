import express from 'express';
import morgan from 'morgan';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import aiRoutes from './routes/ai.routes.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { getDbStatus, requireDatabase } from './db/db.js';

const defaultAllowedOrigins = [
    'https://nviam-code.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174'
];

const allowedOrigins = [
    ...defaultAllowedOrigins,
    ...(process.env.FRONTEND_URL ? [ process.env.FRONTEND_URL ] : []),
    ...(process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
        : [])
];

const normalizedAllowedOrigins = [ ...new Set(allowedOrigins) ];

const corsOptions = {
    origin(origin, callback) {
        if (!origin || normalizedAllowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(null, false);
    },
    credentials: true,
    methods: [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS' ],
    allowedHeaders: [ 'Content-Type', 'Authorization', 'X-Requested-With' ],
    optionsSuccessStatus: 204
};

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;

    if (requestOrigin && normalizedAllowedOrigins.includes(requestOrigin)) {
        res.header('Access-Control-Allow-Origin', requestOrigin);
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Vary', 'Origin');
    }

    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Cross-Origin-Embedder-Policy', 'credentialless');
    res.header('Cross-Origin-Opener-Policy', 'same-origin');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.use('/users', requireDatabase, userRoutes);
app.use('/projects', requireDatabase, projectRoutes);
app.use('/ai', requireDatabase, aiRoutes);

app.get('/', (req, res) => {
    res.status(200).json({
        ok: true,
        service: 'nviam-code-backend'
    });
});

app.get('/health', (req, res) => {
    const db = getDbStatus();

    res.status(db.ready ? 200 : 503).json({
        ok: db.ready,
        db
    });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error('Unhandled application error:', err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});

export default app;
