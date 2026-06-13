# DiffTools Dashboard (MERN + C++ Core)

A high-performance visual comparison workspace combining a **C++ Diff Core** (implementing three distinct diffing algorithms) with a **MERN Stack** (MongoDB, Express, React, Node.js) interactive dashboard.

---

## Key Features

1. **Myers' Diff Algorithm**: Line-based greedy path-finding on the edit graph ($O(ND)$ time/space).
2. **Histogram Diff Algorithm**: Git's modern patience-extension diffing that anchors on unique/rare lines for highly human-readable diff layouts.
3. **GumTree AST Diff Algorithm**: Fine-grained structural matching that parses C-like code and Lisp S-expressions into trees, matching them top-down and bottom-up to detect **inserts, deletes, updates, and moves**.
4. **Interactive Dashboard**: Side-by-side split and unified code editors/views with color-coding (red/green for text, yellow/blue for tree moves/updates).
5. **MongoDB History Log**: Persists and reloads previous comparisons from the database, with a built-in memory failover if local MongoDB is offline.

---

## Directory Structure

```
diffproject/
├── backend/
│   ├── models/
│   │   └── Comparison.js        # Mongoose Schema
│   ├── src/
│   │   ├── diff_core.h          # Core types and structs
│   │   ├── myers.cpp            # Myers diff engine
│   │   ├── histogram.cpp        # Histogram diff engine
│   │   ├── ast.h / ast.cpp      # AST representations & Parsers
│   │   ├── gumtree.cpp          # GumTree AST matchers
│   │   └── main.cpp             # CLI coordinator
│   ├── temp/                    # Temporary execution directory
│   ├── package.json
│   ├── server.js                # Express API & process spawner
│   └── diff_engine.exe          # Compiled C++ binary
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DiffViewer.jsx   # Text split/unified renderer
│   │   │   └── ASTDiffViewer.jsx # AST side-by-side tree renderer
│   │   ├── App.jsx              # Main dashboard component
│   │   ├── index.css            # Dark glassmorphism stylesheet
│   │   └── main.jsx
│   └── package.json
└── README.md
```

---

## Setup & Running Instructions

### 1. Compile C++ Diff Engine
Navigate to the root workspace and compile the C++ source files using a C++14 (or higher) compiler:
```bash
g++ -O3 -std=c++14 backend/src/main.cpp backend/src/myers.cpp backend/src/histogram.cpp backend/src/ast.cpp backend/src/gumtree.cpp -o backend/diff_engine.exe
```

### 2. Start Backend Server
Navigate to the `backend/` directory, install packages, and start the server:
```bash
cd backend
npm install
node server.js
```
The server will boot on [http://localhost:5000](http://localhost:5000). Ensure your local MongoDB instance is running on port `27017` (the server will fall back to in-memory history if offline).

### 3. Start Frontend Dashboard
Navigate to the `frontend/` directory, install packages, and start Vite dev server:
```bash
cd ../frontend
npm install
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser to access the dashboard.
