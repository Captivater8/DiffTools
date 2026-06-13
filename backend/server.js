const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const Comparison = require('./models/Comparison');

const app = express();
app.use(cors());
app.use(express.json());

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// In-memory fallback if MongoDB is not running
let dbConnected = false;
let memoryHistory = [];

const mongoURI = 'mongodb://127.0.0.1:27017/diffproject';
mongoose.connect(mongoURI)
    .then(() => {
        console.log('Successfully connected to MongoDB.');
        dbConnected = true;
    })
    .catch((err) => {
        console.warn('MongoDB connection failed. Running with In-Memory history fallback.', err.message);
        dbConnected = false;
    });

// C++ Engine Path
const enginePath = path.join(__dirname, 'diff_engine.exe');

// Route to compute diff
app.post('/api/diff', (req, res) => {
    const { title, textA, textB, algorithm } = req.body;
    
    if (!title || textA === undefined || textB === undefined || !algorithm) {
        return res.status(400).json({ error: 'Missing required fields: title, textA, textB, algorithm' });
    }
    
    const timestamp = Date.now();
    const fileAPath = path.join(tempDir, `temp_${timestamp}_A.txt`);
    const fileBPath = path.join(tempDir, `temp_${timestamp}_B.txt`);
    
    try {
        fs.writeFileSync(fileAPath, textA, 'utf8');
        fs.writeFileSync(fileBPath, textB, 'utf8');
    } catch (err) {
        return res.status(500).json({ error: 'Failed to write temporary files: ' + err.message });
    }
    
    // Check if C++ binary exists
    if (!fs.existsSync(enginePath)) {
        try { fs.unlinkSync(fileAPath); fs.unlinkSync(fileBPath); } catch(_) {}
        return res.status(500).json({ error: 'C++ diff engine not found. Ensure it compiles successfully.' });
    }
    
    // Spawn C++ binary
    execFile(enginePath, [algorithm, fileAPath, fileBPath], { maxBuffer: 10 * 1024 * 1024 }, async (err, stdout, stderr) => {
        // Clean up temp files
        try { fs.unlinkSync(fileAPath); } catch(_) {}
        try { fs.unlinkSync(fileBPath); } catch(_) {}
        
        if (err) {
            console.error('Execution error:', err);
            console.error('stderr:', stderr);
            return res.status(500).json({ error: 'Failed to execute diff engine: ' + stderr });
        }
        
        try {
            const diffResult = JSON.parse(stdout);
            
            const record = {
                title,
                textA,
                textB,
                algorithm,
                diffResult,
                createdAt: new Date()
            };
            
            if (dbConnected) {
                try {
                    const saved = await Comparison.create(record);
                    return res.json(saved);
                } catch (dbErr) {
                    console.error('Failed to save comparison to MongoDB:', dbErr);
                    record._id = 'mem_' + Date.now();
                    memoryHistory.unshift(record);
                    return res.json(record);
                }
            } else {
                record._id = 'mem_' + Date.now();
                memoryHistory.unshift(record);
                return res.json(record);
            }
            
        } catch (parseErr) {
            console.error('JSON Parse error on output:', stdout);
            return res.status(500).json({ error: 'Failed to parse diff output: ' + parseErr.message });
        }
    });
});

// Route to get history
app.get('/api/history', async (req, res) => {
    if (dbConnected) {
        try {
            const history = await Comparison.find().sort({ createdAt: -1 }).select('-textA -textB -diffResult');
            return res.json(history);
        } catch (dbErr) {
            console.error('MongoDB find error:', dbErr);
            return res.json(memoryHistory.map(h => ({ _id: h._id, title: h.title, algorithm: h.algorithm, createdAt: h.createdAt })));
        }
    } else {
        return res.json(memoryHistory.map(h => ({ _id: h._id, title: h.title, algorithm: h.algorithm, createdAt: h.createdAt })));
    }
});

// Route to get single record
app.get('/api/history/:id', async (req, res) => {
    const { id } = req.params;
    if (dbConnected && !id.startsWith('mem_')) {
        try {
            const record = await Comparison.findById(id);
            if (!record) return res.status(404).json({ error: 'Record not found' });
            return res.json(record);
        } catch (dbErr) {
            console.error('MongoDB findById error:', dbErr);
            return res.status(500).json({ error: 'Failed to retrieve record' });
        }
    } else {
        const record = memoryHistory.find(h => h._id === id);
        if (!record) return res.status(404).json({ error: 'Record not found' });
        return res.json(record);
    }
});

// Route to delete record
app.delete('/api/history/:id', async (req, res) => {
    const { id } = req.params;
    if (dbConnected && !id.startsWith('mem_')) {
        try {
            const deleted = await Comparison.findByIdAndDelete(id);
            if (!deleted) return res.status(404).json({ error: 'Record not found' });
            return res.json({ success: true });
        } catch (dbErr) {
            console.error('MongoDB delete error:', dbErr);
            return res.status(500).json({ error: 'Failed to delete record' });
        }
    } else {
        const index = memoryHistory.findIndex(h => h._id === id);
        if (index === -1) return res.status(404).json({ error: 'Record not found' });
        memoryHistory.splice(index, 1);
        return res.json({ success: true });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
