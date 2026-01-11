import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { sqlite } from "./db";
import { initializeStorage } from "./storage";

const app = express();

const sessionSecret = process.env.SESSION_SECRET || 'your-secret-key-should-be-32-characters-long';
if (process.env.NODE_ENV === 'production' && sessionSecret === 'your-secret-key-should-be-32-characters-long') {
  console.warn('WARNING: Using default session secret. In production, set SESSION_SECRET env var.');
}

// --- Malformed URI guard (prevents Vite crash on scanners like Nikto) ---
app.use((req, res, next) => {
  try {
    // Check for malformed URI sequences
    decodeURI(req.url);
    // Check for valid URL structure to prevent Vite's internal new URL() from crashing
    new URL(req.url, `http://${req.headers.host || "localhost"}`);
    next();
  } catch (e) {
    res.status(400).send("Bad Request");
  }
});

// --- Body parsing ---
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Request logging for /api routes ---
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 120) logLine = logLine.slice(0, 119) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  // --- Storage & session setup ---
  initializeStorage(sqlite);
  const { storage } = await import("./storage");

  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    },
    name: 'ess.sid'
  }));

  // --- CRITICAL FIX: Session Stability Guard ---
  // Ensures req.session exists even if the store fails or the request is malformed,
  // preventing Passport from crashing with "Login sessions require session support".
  app.use((req, res, next) => {
    if (!(req as any).session) {
      (req as any).session = {};
    }
    next();
  });

  // --- Passport init AFTER session ---
  app.use(passport.initialize());
  app.use(passport.session());

  // --- API routes ---
  const server = await registerRoutes(app);

  // --- Global error handler ---
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    // Don't log expected 400s or auth failures as critical errors
    if (status >= 500) {
      log(`[ERROR] ${status} - ${message}`);
    }
  });

  // --- Vite or static ---
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // --- Start server ---
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "0.0.0.0", () => log(`Serving on port ${port}`));
})();