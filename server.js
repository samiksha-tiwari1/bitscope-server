const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const BLOCKSTREAM = "https://blockstream.info/api";
const PORT = 4000;

/* ---------------- IN-MEMORY CACHE ---------------- */

let blocksCache = [];
let mempoolCache = [];

/* Axios instance */
const api = axios.create({
  baseURL: BLOCKSTREAM,
  timeout: 10000,
});

/* ---------------- BACKGROUND FETCHER ---------------- */

async function refreshData() {
  try {
    console.log("Refreshing data from Blockstream...");

    const [blocksRes, mempoolRes] = await Promise.all([
      api.get("/blocks"),
      api.get("/mempool/recent"),
    ]);

    // Clean blocks shape
    blocksCache = blocksRes.data.slice(0, 15).map((b) => ({
      id: b.id,
      height: b.height,
      timestamp: b.timestamp,
      tx_count: b.tx_count,
    }));

    // Clean mempool shape
    mempoolCache = mempoolRes.data.slice(0, 10).map((t) => ({
      txid: t.txid,
      fee: t.fee,
      vsize: t.vsize,
    }));

    console.log("Data cache updated");
  } catch (e) {
    console.log("Blockstream rate limit hit. Using old cache.");
  }
}

/* Initial fetch at server start */
refreshData();

/* Refresh every 30 seconds */
setInterval(refreshData, 30000);

/* ---------------- ROUTES ---------------- */

/* Latest Blocks (served from cache) */
app.get("/blocks", (_, res) => {
  res.json(blocksCache);
});

/* Recent Mempool (served from cache) */
app.get("/mempool", (_, res) => {
  res.json(mempoolCache);
});

/* Single Transaction (live fetch — rare call, safe) */
app.get("/tx/:id", async (req, res) => {
  try {
    const { data } = await api.get(`/tx/${req.params.id}`);
    res.json(data);
  } catch {
    res.status(500).json({ error: "Transaction fetch failed" });
  }
});

/* Health check */
app.get("/", (_, res) => {
  res.json({
    status: "running",
    service: "BitScope API",
    endpoints: ["/blocks", "/mempool", "/tx/:id"],
  });
});

/* ---------------- START ---------------- */

app.listen(PORT, () => {
  console.log(`BitScope API running on http://localhost:${PORT}`);
});