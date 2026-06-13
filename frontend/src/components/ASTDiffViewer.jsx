import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, CornerDownRight, Play, RotateCcw } from 'lucide-react';

export default function ASTDiffViewer({ diffResult }) {
    const [hoveredNodeId, setHoveredNodeId] = useState(null);
    const [collapsedNodes, setCollapsedNodes] = useState(new Set());
    const [mappings, setMappings] = useState({ A_to_B: {}, B_to_A: {} });
    
    if (!diffResult || !diffResult.treeA || !diffResult.treeB) return null;
    
    const { treeA, treeB, diff } = diffResult;

    // Sets of operation IDs
    const deletedIds = new Set(diff.filter(d => d.type === 'delete').map(d => d.nodeId));
    const updatedIds = new Set(diff.filter(d => d.type === 'update').map(d => d.nodeId));
    const movedIds = new Set(diff.filter(d => d.type === 'move').map(d => d.nodeId));
    const insertedIds = new Set(diff.filter(d => d.type === 'insert').map(d => d.nodeId));

    // Reconstruct mappings in the frontend using order-preserving filter
    useEffect(() => {
        const preOrder = (node, list = []) => {
            if (!node) return list;
            list.push(node);
            if (node.children) {
                for (const child of node.children) {
                    preOrder(child, list);
                }
            }
            return list;
        };

        const listA = preOrder(treeA).filter(n => !deletedIds.has(n.id));
        const listB = preOrder(treeB).filter(n => !insertedIds.has(n.id));

        const A_to_B = {};
        const B_to_A = {};
        const len = Math.min(listA.length, listB.length);
        
        for (let i = 0; i < len; i++) {
            A_to_B[listA[i].id] = listB[i].id;
            B_to_A[listB[i].id] = listA[i].id;
        }

        setMappings({ A_to_B, B_to_A });
    }, [treeA, treeB, diff]);

    const toggleCollapse = (id) => {
        const next = new Set(collapsedNodes);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setCollapsedNodes(next);
    };

    const expandAll = (tree) => {
        setCollapsedNodes(new Set());
    };

    const collapseAll = (tree) => {
        const collectIds = (node, acc = []) => {
            if (!node) return acc;
            if (node.children && node.children.length > 0) {
                acc.push(node.id);
                for (const child of node.children) {
                    collectIds(child, acc);
                }
            }
            return acc;
        };
        const ids = [...collectIds(treeA), ...collectIds(treeB)];
        setCollapsedNodes(new Set(ids));
    };

    // Helper to determine node highlight class
    const getNodeClass = (nodeId, isTreeB) => {
        let classes = 'tree-node-item ';
        
        // Check hover link
        if (hoveredNodeId !== null) {
            if (isTreeB) {
                if (hoveredNodeId === nodeId || mappings.A_to_B[hoveredNodeId] === nodeId) {
                    classes += 'node-highlighted ';
                }
            } else {
                if (hoveredNodeId === nodeId || mappings.B_to_A[hoveredNodeId] === nodeId) {
                    classes += 'node-highlighted ';
                }
            }
        }

        if (isTreeB) {
            if (insertedIds.has(nodeId)) {
                classes += 'node-insert';
            } else {
                const mappedAId = mappings.B_to_A[nodeId];
                if (mappedAId) {
                    if (updatedIds.has(mappedAId)) classes += 'node-update';
                    else if (movedIds.has(mappedAId)) classes += 'node-move';
                }
            }
        } else {
            if (deletedIds.has(nodeId)) {
                classes += 'node-delete';
            } else if (updatedIds.has(nodeId)) {
                classes += 'node-update';
            } else if (movedIds.has(nodeId)) {
                classes += 'node-move';
            }
        }

        return classes;
    };

    // Helper to handle hover
    const handleMouseEnter = (nodeId, isTreeB) => {
        if (isTreeB) {
            const mappedAId = mappings.B_to_A[nodeId];
            setHoveredNodeId(mappedAId || nodeId);
        } else {
            setHoveredNodeId(nodeId);
        }
    };

    const handleMouseLeave = () => {
        setHoveredNodeId(null);
    };

    // Render tree recursively
    const renderTree = (node, isTreeB) => {
        if (!node) return null;
        const hasChildren = node.children && node.children.length > 0;
        const isCollapsed = collapsedNodes.has(node.id);
        
        // Find if node has a value modification to show in the pill
        let valueDisplay = node.value;
        if (!isTreeB && updatedIds.has(node.id)) {
            const op = diff.find(d => d.type === 'update' && d.nodeId === node.id);
            if (op) {
                valueDisplay = `${op.oldValue} → ${op.newValue}`;
            }
        }

        return (
            <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div 
                    className={getNodeClass(node.id, isTreeB)}
                    onMouseEnter={() => handleMouseEnter(node.id, isTreeB)}
                    onMouseLeave={handleMouseLeave}
                >
                    {hasChildren ? (
                        <button className="node-collapse-btn" onClick={() => toggleCollapse(node.id)}>
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </button>
                    ) : (
                        <div style={{ width: '16px' }} />
                    )}
                    <span className="node-type-pill">{node.type}</span>
                    {valueDisplay && <span className="node-value-text">{valueDisplay}</span>}
                </div>
                {hasChildren && !isCollapsed && (
                    <div className="tree-node-children">
                        {node.children.map(child => renderTree(child, isTreeB))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="glass-panel viz-panel">
            <div className="viz-header">
                <div className="viz-title">
                    <span>GumTree AST Diff Visualizer</span>
                    <span className="algo-pill">gumtree</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={expandAll}>
                        Expand All
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={collapseAll}>
                        Collapse All
                    </button>
                </div>
            </div>

            <div className="ast-container">
                {/* Left Tree - File A */}
                <div className="ast-pane">
                    <div className="split-header">Original AST (File A)</div>
                    <div className="ast-tree-scroll">
                        {renderTree(treeA, false)}
                    </div>
                </div>

                {/* Right Tree - File B */}
                <div className="ast-pane">
                    <div className="split-header">Modified AST (File B)</div>
                    <div className="ast-tree-scroll">
                        {renderTree(treeB, true)}
                    </div>
                </div>
            </div>

            {/* Edit Script Operations List */}
            <div className="ast-ops-list">
                <div className="ast-ops-title">
                    <Play size={16} className="logo-icon" />
                    <span>Edit Script Operations ({diff.length})</span>
                </div>
                {diff.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)' }}>No structural changes detected. Trees are isomorphic.</div>
                ) : (
                    <div className="ops-grid">
                        {diff.map((op, idx) => {
                            let typeColor = 'op-indicator-insert';
                            let text = '';
                            
                            if (op.type === 'delete') {
                                typeColor = 'op-indicator-delete';
                                text = `Delete node #${op.nodeId} (${op.nodeType}) with value "${op.oldValue}"`;
                            } else if (op.type === 'insert') {
                                typeColor = 'op-indicator-insert';
                                text = `Insert node #${op.nodeId} (${op.nodeType}) "${op.newValue}" under parent #${op.parentId} at position ${op.pos}`;
                            } else if (op.type === 'update') {
                                typeColor = 'op-indicator-update';
                                text = `Update node #${op.nodeId} (${op.nodeType}) value: "${op.oldValue}" → "${op.newValue}"`;
                            } else if (op.type === 'move') {
                                typeColor = 'op-indicator-move';
                                text = `Move node #${op.nodeId} (${op.nodeType}) to parent #${op.parentId} at position ${op.pos}`;
                            }

                            return (
                                <div key={idx} className="op-badge">
                                    <div className={`op-indicator ${typeColor}`} />
                                    <div className="op-text">
                                        <span className="op-code">{op.type.toUpperCase()}</span> {text}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
