import React, { useState, useEffect } from 'react';
import { Play, History, Trash2, FileText, Code2, AlertTriangle, HelpCircle, GitCommit } from 'lucide-react';
import DiffViewer from './components/DiffViewer';
import ASTDiffViewer from './components/ASTDiffViewer';

const API_BASE = 'http://localhost:5000/api';

const SAMPLES = {
    text: {
        title: "Document Revision Comparison",
        algorithm: "histogram",
        textA: "The quick brown fox jumps over the lazy dog.\nThis is a standard text comparison example.\nWe can see how lines are matched.\nHistogram diff is great for aligning identical lines.\nMyers diff will also do this, but with different path minimization.",
        textB: "The quick brown fox jumps over the active dog.\nThis is a standard text comparison example.\nWe can see how lines are matched.\nHere is an added line in the middle.\nHistogram diff is great for aligning identical lines.\nMyers diff will also do this, but with different path minimization.\nAnother added line at the end."
    },
    code: {
        title: "Refactoring AST Comparison",
        algorithm: "gumtree",
        textA: `// Original C-like source code
function calculate() {
    var val = 10;
    if (val > 5) {
        return val + 1;
    }
    return 0;
}`,
        textB: `// Refactored source code (renamed variable, added assignment, changed return)
function calculate() {
    var x = 10;
    if (x > 5) {
        x = x + 2;
        return x;
    }
    return 1;
}`
    },
    sexpr: {
        title: "Hierarchical Tree Comparison (S-Expressions)",
        algorithm: "gumtree",
        textA: `(Program
  (FunctionDecl main
    (Parameters
      (Identifier x)
    )
    (Block
      (VarDecl y
        (Literal 10)
      )
      (ReturnStatement
        (Identifier x)
      )
    )
  )
)`,
        textB: `(Program
  (FunctionDecl main
    (Parameters
      (Identifier x)
    )
    (Block
      (VarDecl y
        (Literal 20)
      )
      (Assign y
        (BinaryExpr +
          (Identifier y)
          (Literal 5)
        )
      )
      (ReturnStatement
        (Identifier y)
      )
    )
  )`
    }
};

export default function App() {
    const [title, setTitle] = useState('New Comparison');
    const [algorithm, setAlgorithm] = useState('myers');
    const [textA, setTextA] = useState('');
    const [textB, setTextB] = useState('');
    
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [diffResult, setDiffResult] = useState(null);
    const [activeHistoryId, setActiveHistoryId] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            const res = await fetch(`${API_BASE}/history`);
            if (!res.ok) throw new Error('Failed to load history');
            const data = await res.json();
            setHistory(data);
        } catch (err) {
            console.error('Error loading history:', err);
            setError('Could not connect to backend server. Running in fallback mode.');
        }
    };

    const runDiff = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/diff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, textA, textB, algorithm })
            });
            
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Diff execution failed');
            }
            
            const data = await res.json();
            setDiffResult(data.diffResult ? data : { algorithm, diffResult: data }); // handle fallback format
            setActiveHistoryId(data._id);
            
            // Reload history to show this new comparison in list
            loadHistory();
        } catch (err) {
            console.error('Error running diff:', err);
            setError(err.message || 'Server error. Ensure backend is running.');
        } finally {
            setLoading(false);
        }
    };

    const loadComparison = async (id) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/history/${id}`);
            if (!res.ok) throw new Error('Failed to fetch comparison details');
            const data = await res.json();
            
            setTitle(data.title);
            setAlgorithm(data.algorithm);
            setTextA(data.textA);
            setTextB(data.textB);
            setDiffResult(data);
            setActiveHistoryId(data._id);
        } catch (err) {
            console.error('Error loading comparison:', err);
            setError('Failed to retrieve comparison record.');
        } finally {
            setLoading(false);
        }
    };

    const deleteComparison = async (id, e) => {
        e.stopPropagation(); // prevent loading item
        try {
            const res = await fetch(`${API_BASE}/history/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete comparison');
            
            setHistory(history.filter(h => h._id !== id));
            if (activeHistoryId === id) {
                setDiffResult(null);
                setActiveHistoryId(null);
            }
        } catch (err) {
            console.error('Error deleting comparison:', err);
            setError('Failed to delete comparison record.');
        }
    };

    const loadSample = (key) => {
        const sample = SAMPLES[key];
        setTitle(sample.title);
        setAlgorithm(sample.algorithm);
        setTextA(sample.textA);
        setTextB(sample.textB);
        setDiffResult(null);
        setActiveHistoryId(null);
    };

    return (
        <div className="app-container">
            <header className="app-header glass-panel" style={{ border: 0, borderBottom: '1px solid var(--glass-border)', borderRadius: 0 }}>
                <div className="logo-section">
                    <GitCommit className="logo-icon" size={28} />
                    <h1 className="logo-text">DiffEngine Dashboard</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span className="algo-pill" style={{ color: 'var(--accent-purple)' }}>Myers</span>
                    <span className="algo-pill" style={{ color: 'var(--accent-cyan)' }}>Histogram</span>
                    <span className="algo-pill" style={{ color: 'var(--accent-yellow)' }}>GumTree</span>
                </div>
            </header>

            <div className="dashboard-grid">
                {/* Sidebar History Panel */}
                <aside className="sidebar">
                    <div className="sidebar-title">
                        <History size={16} />
                        <span>Comparison History</span>
                    </div>
                    {history.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '1rem 0' }}>
                            No past comparisons saved.
                        </div>
                    ) : (
                        <ul className="history-list">
                            {history.map(item => (
                                <li 
                                    key={item._id} 
                                    onClick={() => loadComparison(item._id)}
                                    className={`history-item ${activeHistoryId === item._id ? 'active' : ''}`}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                        <span style={{ fontWeight: 500, fontSize: '0.85rem', wordBreak: 'break-all' }}>{item.title}</span>
                                        <button 
                                            onClick={(e) => deleteComparison(item._id, e)}
                                            className="delete-history-btn"
                                            title="Delete record"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div className="history-meta">
                                        <span className="algo-pill">{item.algorithm}</span>
                                        <span>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>

                {/* Workspace Panel */}
                <main className="workspace">
                    {error && (
                        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', borderColor: 'var(--accent-red)', background: 'rgba(239,68,68,0.08)' }}>
                            <AlertTriangle color="var(--accent-red)" size={20} />
                            <span style={{ fontSize: '0.875rem', color: '#fca5a5' }}>{error}</span>
                        </div>
                    )}

                    {/* Inputs panel */}
                    <div className="glass-panel control-panel">
                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
                            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Diff Setup</h2>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', gap: '0.25rem' }} onClick={() => loadSample('text')}>
                                    <FileText size={14} />
                                    Text Sample
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', gap: '0.25rem' }} onClick={() => loadSample('code')}>
                                    <Code2 size={14} />
                                    Code Sample
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', gap: '0.25rem' }} onClick={() => loadSample('sexpr')}>
                                    <HelpCircle size={14} />
                                    Tree S-Expr
                                </button>
                            </div>
                        </div>

                        {/* Title & Algorithm Row */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="editor-label">Comparison Title</label>
                            <input 
                                type="text"
                                className="text-input"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Code update v1 vs v2"
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label className="editor-label">Diffing Algorithm</label>
                            <select 
                                className="select-input"
                                value={algorithm}
                                onChange={(e) => setAlgorithm(e.target.value)}
                            >
                                <option value="myers">Myers Diff (Line Text)</option>
                                <option value="histogram">Histogram Diff (Line Text - Patience extension)</option>
                                <option value="gumtree">GumTree Diff (AST-based - Structural)</option>
                            </select>
                        </div>

                        {/* Text Areas */}
                        <div className="editors-container" style={{ gridColumn: '1 / -1' }}>
                            <div className="editor-box">
                                <span className="editor-label">Original Content (File A)</span>
                                <textarea 
                                    className="code-editor"
                                    value={textA}
                                    onChange={(e) => setTextA(e.target.value)}
                                    placeholder="Paste original text or code here..."
                                />
                            </div>
                            <div className="editor-box">
                                <span className="editor-label">Modified Content (File B)</span>
                                <textarea 
                                    className="code-editor"
                                    value={textB}
                                    onChange={(e) => setTextB(e.target.value)}
                                    placeholder="Paste modified text or code here..."
                                />
                            </div>
                        </div>

                        <div className="actions-bar">
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Note: GumTree works best with simple C-like program code or S-expressions, and falls back to word-indented trees for text.
                            </span>
                            <button 
                                onClick={runDiff}
                                disabled={loading || !textA || !textB}
                                className="btn btn-primary"
                            >
                                <Play size={16} />
                                {loading ? 'Computing Diff...' : 'Run Diff Engine'}
                            </button>
                        </div>
                    </div>

                    {/* Output panel */}
                    {loading && (
                        <div className="glass-panel empty-state">
                            <div className="logo-icon pulse-border" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Play size={20} />
                            </div>
                            <span style={{ fontSize: '0.9rem' }}>Calling C++ diff engine and generating outputs...</span>
                        </div>
                    )}

                    {!loading && !diffResult && (
                        <div className="glass-panel empty-state">
                            <HelpCircle className="empty-icon" size={48} />
                            <div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-main)' }}>No Comparison Computed</h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Setup your files and click "Run Diff Engine" or select a past run from history.</p>
                            </div>
                        </div>
                    )}

                    {!loading && diffResult && (
                        <>
                            {diffResult.algorithm === 'gumtree' ? (
                                <ASTDiffViewer diffResult={diffResult.diffResult || diffResult} />
                            ) : (
                                <DiffViewer diffResult={diffResult.diffResult || diffResult} />
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}
