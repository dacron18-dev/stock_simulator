import express from "express";
import cors from "cors";
import 'dotenv/config';
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// import { generateObfuscatedData } from "./generate-competition.js";
import { readFile } from "fs/promises";
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS) || 50;

function setupApp(__dirname, MAX_CONNECTIONS) {
  const connections = [];
  const app = express();

  console.log(`Setting up app with max connections: ${MAX_CONNECTIONS}`);
  app.use(cors());

  app.get("/", (req, res) => {
    console.log(`Serving index.html to ${req.ip}`);
    res.sendFile(path.join(__dirname, "static/index.html"));
  });

  app.get("/stock-stream", (req, res) => {
    console.log(`New connection attempt from ${req.ip}. Current connections: ${connections.length}/${MAX_CONNECTIONS}`);

    if (connections.length >= MAX_CONNECTIONS) {
      console.log(`Connection rejected: max connections (${MAX_CONNECTIONS}) reached`);
      res.status(503).end();
      return;
    }

    // Set SSE headers
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders?.();

    // Send an initial comment to keep connection alive in some proxies
    res.write(": OK\n\n");

    connections.push(res);
    console.log(`Connection established. Total connections: ${connections.length}`);

    req.on("close", () => {
      const idx = connections.indexOf(res);
      if (idx !== -1) connections.splice(idx, 1);
      console.log(`Connection closed. Total connections: ${connections.length}`);
      try {
        res.end();
      } catch (e) {
        console.log(`Error ending connection: ${e.message}`);
      }
    });
  });

  return { app, connections };
}

const { app, connections } = setupApp(__dirname, MAX_CONNECTIONS);

export default app;

async function loadData() {
  console.log("Initializing Supabase client for data loading");
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  console.log("Downloading competition-data.json from Supabase storage");
  // Use the JS library to download a file.
  const { data: uploadedFile, error } = await supabase?.storage?.from('data').download('competition-data.json');
  if (error) {
    console.error('Error downloading file:', error.message);
    return { data: null, startTime: null };
  }

  let data;
  let startTime;
  try {
    const fileContent = uploadedFile ? await uploadedFile.text() : '';
    console.log(`Downloaded file content length: ${fileContent.length} characters`);

    const parsed = JSON.parse(fileContent);
    if (parsed && parsed.data) {
      data = parsed.data;
      startTime = parsed.startTime;
      console.log(`Loaded obfuscated competition data: ${data.length} entries, startTime: ${startTime}`);
    } else {
      data = parsed; // fallback to old format
      console.log(`Loaded data using fallback format: ${Array.isArray(data) ? data.length : 'unknown'} entries`);
    }
  } catch (error) {
    console.error("Error parsing loaded data:", error.message);
    console.log("Falling back to empty data");
    data = null;
    startTime = null;
  }
  return { data, startTime };
}

function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

async function startStreaming(data, startTime, connections) {
  const length = data?.length ?? 246;
  const durationInSec = length; // 246 seconds total
  const intervalInSec = 1; // 1 second intervals

  console.log(`Starting streaming with ${length} data points over ${durationInSec} seconds (${intervalInSec}s intervals)`);
  console.log(`Start time: ${startTime ? new Date(startTime).toISOString() : 'immediate'}`);

  let interval;

  const sendStockData = () => {
    const now = Date.now();
    const elapsed = now - (startTime || now);
    const iteration = Math.floor(elapsed / 36000);

    console.log(`${formatTime(now)}: Iteration ${iteration}, Active connections: ${connections.length}`);

    try {
      const stockData = data[iteration % length];
      const out = JSON.stringify({ index: iteration, stockData });

      console.log(`Sending data for iteration ${iteration}: ${stockData ? 'data present' : 'no data'}`);

      let successCount = 0;
      connections.forEach((res) => {
        try {
          res.write(`data: ${out}\n\n`);
          successCount++;
        } catch (e) {
          console.log(`Failed to send data to connection: ${e.message}`);
          // ignore broken connections here; 'close' handler will cleanup
        }
      });
      console.log(`Data sent successfully to ${successCount}/${connections.length} connections`);
    } catch (err) {
      console.error("Error while preparing/sending stock data:", err.message);
    }
  };

  // Send immediately, then every interval
  console.log("Sending initial data batch");
  sendStockData();
  interval = setInterval(sendStockData, intervalInSec * 1000);
  console.log(`Streaming interval set to ${intervalInSec * 1000}ms`);

  return interval;
}

async function main() {
  console.log("Starting paper trading application");
  dotenv.config();
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  console.log("Loading competition data...");
  const { data, startTime } = await loadData();

  console.log("Initializing data streaming...");
  const interval = await startStreaming(data, startTime, connections);

  if (process.env.NODE_ENV !== 'production') {
    // For local development, start the server
    console.log(`Starting server on port ${PORT} for local development`);
    const server = app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
      console.log("Application startup complete");
    });
  } else {
    console.log("Running in production mode - server should be handled by deployment platform");
  }
}

main();

// // graceful shutdown
// process.on("SIGINT", () => {
//   clearInterval(interval);
//   server.close(() => process.exit(0));
// });

