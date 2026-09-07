const DEFAULT_CLIENT_URL = "http://localhost:5173";

const normalizeOrigin = (origin) => origin?.trim().replace(/\/$/, "");

export const getAllowedOrigins = () => {
    const origins = process.env.CLIENT_URLS || process.env.CLIENT_URL || DEFAULT_CLIENT_URL;

    return origins
        .split(",")
        .map(normalizeOrigin)
        .filter(Boolean);
};

export const corsOrigin = (origin, callback) => {
    if (!origin) {
        callback(null, true);
        return;
    }

    const allowedOrigins = getAllowedOrigins();
    if (allowedOrigins.includes(normalizeOrigin(origin))) {
        callback(null, true);
        return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
};
