const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const Comparison = require("./models/Comparison");

const app = express();
app.use(cors());
app.use(express.json());

// Ensure temp directory exists
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// In-memory fallback if MongoDB is not running
let dbConnected = false;
let memoryHistory = [];

const mongoURI = "mongodb://127.0.0.1:27017/diffproject";
mongoose
  .connect(mongoURI)
  .then(() => {
    console.log("Successfully connected to MongoDB.");
    dbConnected = true;
  })
  .catch((err) => {
    console.warn(
      "MongoDB connection failed. Running with In-Memory history fallback.",
      err.message,
    );
    dbConnected = false;
  });

// C++ Engine Path
const enginePath = path.join(__dirname, "diff_engine.exe");

function estimateComplexity(code) {
  const lines = code.split("\n");
  const lowerCode = code.toLowerCase();

  let loops = 0;
  let maxLoopDepth = 0;
  let currentDepth = 0;

  let hasSort = false;
  let hasBinarySearch = false;
  let hasLogLoop = false;
  let hasSqrtLoop = false;

  for (const line of lines) {
    if (/\bfor\s*\(/.test(line) || /\bwhile\s*\(/.test(line)) {
      loops++;
      currentDepth++;
      maxLoopDepth = Math.max(maxLoopDepth, currentDepth);
    }

    if (line.includes("}")) {
      currentDepth = Math.max(0, currentDepth - 1);
    }
    if (/i\s*\*\s*i\s*<=/.test(line) || /j\s*\*\s*j\s*<=/.test(line)) {
      hasSqrtLoop = true;
    }

    if (/i\s*\*=/.test(line) || /j\s*\*=/.test(line) || /\/= *2/.test(line)) {
      hasLogLoop = true;
    }
    if (line.includes("sort(") || line.includes("std::sort(")) {
      hasSort = true;
    }

    if (
      line.includes("binary_search(") ||
      line.includes("lower_bound(") ||
      line.includes("upper_bound(")
    ) {
      hasBinarySearch = true;
    }
  }
  // Dijsktra
  if (
    lowerCode.includes("priority_queue") &&
    lowerCode.includes("adj") &&
    lowerCode.includes("dist")
  ) {
    return {
      complexity: "O(E log V)",
      confidence: 80,
      reason: ["Dijkstra-like pattern detected"],
    };
  }
  // DFS / BFS
  if (
    lowerCode.includes("dfs(") ||
    lowerCode.includes("bfs(") ||
    lowerCode.includes("queue<")
  ) {
    return {
      complexity: "O(V + E)",
      confidence: 85,
      reason: ["Graph traversal detected"],
    };
  }

  // DSU Detection
  if (
    lowerCode.includes("parent") &&
    lowerCode.includes("find(") &&
    (lowerCode.includes("union(") ||
      lowerCode.includes("union_sets(") ||
      lowerCode.includes("unite("))
  ) {
    return {
      complexity: "O(α(n))",
      confidence: 85,
      reason: ["Disjoint Set Union detected"],
    };
  }

  // Segment Tree Detection
  if (
    lowerCode.includes("segment") ||
    lowerCode.includes("tree[4*n]") ||
    (lowerCode.includes("query(") && lowerCode.includes("update("))
  ) {
    return {
      complexity: "O(log n)",
      confidence: 85,
      reason: ["Segment Tree detected"],
    };
  }

  // Recursive function detection
  const functions = [
    ...code.matchAll(
      /\b(?:int|long long|void|bool|string|double)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
    ),
  ];

  for (const fn of functions) {
    const name = fn[1];

    const matches = code.match(new RegExp("\\b" + name + "\\s*\\(", "g"));

    const count = matches ? matches.length : 0;

    // definition + 2 recursive calls
    if (count >= 3) {
      return {
        complexity: "O(2^n)",
        confidence: 75,
        reason: [`Branching recursion detected: ${name}`],
      };
    }

    // definition + 1 recursive call
    if (count === 2) {
      return {
        complexity: "O(n)",
        confidence: 75,
        reason: [`Linear recursion detected: ${name}`],
      };
    }
  }

  if (hasSqrtLoop && maxLoopDepth >= 2)
    return {
      complexity: "O(n√n)",
      confidence: 80,
      reason: ["Square-root loop inside traversal"],
    };

  if (hasSqrtLoop)
    return {
      complexity: "O(√n)",
      confidence: 85,
      reason: ["Square-root traversal detected"],
    };

  if (hasLogLoop && maxLoopDepth >= 2)
    return {
      complexity: "O(n log n)",
      confidence: 80,
      reason: ["Nested logarithmic loop detected"],
    };

  if (hasLogLoop)
    return {
      complexity: "O(log n)",
      confidence: 85,
      reason: ["Logarithmic loop detected"],
    };

  if (hasSort && maxLoopDepth >= 1)
    return {
      complexity: "O(n² log n)",
      confidence: 75,
      reason: ["sort() inside loop"],
    };

  if (hasSort)
    return {
      complexity: "O(n log n)",
      confidence: 95,
      reason: ["Detected sort()"],
    };

  if (hasBinarySearch)
    return {
      complexity: "O(log n)",
      confidence: 90,
      reason: ["Detected binary search"],
    };

  if (maxLoopDepth >= 3)
    return {
      complexity: "O(n³)",
      confidence: 90,
      reason: ["3 nested loops"],
    };

  if (maxLoopDepth === 2)
    return {
      complexity: "O(n²)",
      confidence: 95,
      reason: ["2 nested loops"],
    };

  if (maxLoopDepth === 1)
    return {
      complexity: "O(n)",
      confidence: 95,
      reason: ["Single loop"],
    };

  return {
    complexity: "O(1)",
    confidence: 80,
    reason: ["No loops detected"],
  };
}

// Route to compute diff
app.post("/api/diff", (req, res) => {
  const { title, textA, textB, algorithm } = req.body;
  console.log("ALGORITHM RECEIVED:", algorithm);

  if (algorithm === "complexity") {
    console.log("COMPLEXITY BLOCK HIT");
    const complexityA = estimateComplexity(textA);
    const complexityB = estimateComplexity(textB);

    const result = {
      _id: "mem_" + Date.now(),
      title,
      algorithm,
      textA,
      textB,
      complexityA,
      complexityB,
      createdAt: new Date(),
    };

    memoryHistory.unshift(result);

    console.log("COMPLEXITY RESULT:", result);

    return res.json(result);
  }

  if (!title || textA === undefined || textB === undefined || !algorithm) {
    return res.status(400).json({
      error: "Missing required fields: title, textA, textB, algorithm",
    });
  }

  const timestamp = Date.now();
  const fileAPath = path.join(tempDir, `temp_${timestamp}_A.txt`);
  const fileBPath = path.join(tempDir, `temp_${timestamp}_B.txt`);

  try {
    fs.writeFileSync(fileAPath, textA, "utf8");
    fs.writeFileSync(fileBPath, textB, "utf8");
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to write temporary files: " + err.message });
  }

  // Check if C++ binary exists
  if (!fs.existsSync(enginePath)) {
    try {
      fs.unlinkSync(fileAPath);
      fs.unlinkSync(fileBPath);
    } catch (_) {}
    return res.status(500).json({
      error: "C++ diff engine not found. Ensure it compiles successfully.",
    });
  }

  // Spawn C++ binary
  execFile(
    enginePath,
    [algorithm, fileAPath, fileBPath],
    { maxBuffer: 10 * 1024 * 1024 },
    async (err, stdout, stderr) => {
      // Clean up temp files
      try {
        fs.unlinkSync(fileAPath);
      } catch (_) {}
      try {
        fs.unlinkSync(fileBPath);
      } catch (_) {}

      if (err) {
        console.error("Execution error:", err);
        console.error("stderr:", stderr);
        return res
          .status(500)
          .json({ error: "Failed to execute diff engine: " + stderr });
      }

      try {
        const diffResult = JSON.parse(stdout);

        const complexityA = estimateComplexity(textA);

        const complexityB = estimateComplexity(textB);

        const record = {
          title,
          textA,
          textB,
          algorithm,
          diffResult,
          complexityA,
          complexityB,
          createdAt: new Date(),
        };

        if (dbConnected) {
          try {
            const saved = await Comparison.create(record);
            return res.json(saved);
          } catch (dbErr) {
            console.error("Failed to save comparison to MongoDB:", dbErr);
            record._id = "mem_" + Date.now();
            memoryHistory.unshift(record);
            return res.json(record);
          }
        } else {
          record._id = "mem_" + Date.now();
          memoryHistory.unshift(record);
          return res.json(record);
        }
      } catch (parseErr) {
        console.error("JSON Parse error on output:", stdout);
        return res
          .status(500)
          .json({ error: "Failed to parse diff output: " + parseErr.message });
      }
    },
  );
});

// Route to get history
app.get("/api/history", async (req, res) => {
  if (dbConnected) {
    try {
      const history = await Comparison.find()
        .sort({ createdAt: -1 })
        .select("-textA -textB -diffResult");
      return res.json(history);
    } catch (dbErr) {
      console.error("MongoDB find error:", dbErr);
      return res.json(
        memoryHistory.map((h) => ({
          _id: h._id,
          title: h.title,
          algorithm: h.algorithm,
          createdAt: h.createdAt,
        })),
      );
    }
  } else {
    return res.json(
      memoryHistory.map((h) => ({
        _id: h._id,
        title: h.title,
        algorithm: h.algorithm,
        createdAt: h.createdAt,
      })),
    );
  }
});

// Route to get single record
app.get("/api/history/:id", async (req, res) => {
  const { id } = req.params;
  if (dbConnected && !id.startsWith("mem_")) {
    try {
      const record = await Comparison.findById(id);
      if (!record) return res.status(404).json({ error: "Record not found" });
      return res.json(record);
    } catch (dbErr) {
      console.error("MongoDB findById error:", dbErr);
      return res.status(500).json({ error: "Failed to retrieve record" });
    }
  } else {
    const record = memoryHistory.find((h) => h._id === id);
    if (!record) return res.status(404).json({ error: "Record not found" });
    return res.json(record);
  }
});

// Route to delete record
app.delete("/api/history/:id", async (req, res) => {
  const { id } = req.params;
  if (dbConnected && !id.startsWith("mem_")) {
    try {
      const deleted = await Comparison.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ error: "Record not found" });
      return res.json({ success: true });
    } catch (dbErr) {
      console.error("MongoDB delete error:", dbErr);
      return res.status(500).json({ error: "Failed to delete record" });
    }
  } else {
    const index = memoryHistory.findIndex((h) => h._id === id);
    if (index === -1)
      return res.status(404).json({ error: "Record not found" });
    memoryHistory.splice(index, 1);
    return res.json({ success: true });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
