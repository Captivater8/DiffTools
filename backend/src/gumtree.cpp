#include "ast.h"
#include <map>
#include <set>
#include <unordered_map>
#include <algorithm>
#include <cmath>

struct GumTreeContext {
    std::unordered_map<int, int> A_to_B;
    std::unordered_map<int, int> B_to_A;
    std::unordered_map<int, std::shared_ptr<ASTNode>> nodes_A;
    std::unordered_map<int, std::shared_ptr<ASTNode>> nodes_B;
    std::unordered_map<int, std::set<int>> descendants_A;
    std::unordered_map<int, std::set<int>> descendants_B;
};

void cache_descendants(const std::shared_ptr<ASTNode>& node, std::unordered_map<int, std::set<int>>& cache, std::unordered_map<int, std::shared_ptr<ASTNode>>& node_map) {
    node_map[node->id] = node;
    std::set<int> ids;
    for (const auto& child : node->children) {
        cache_descendants(child, cache, node_map);
        ids.insert(child->id);
        const auto& child_ids = cache[child->id];
        ids.insert(child_ids.begin(), child_ids.end());
    }
    cache[node->id] = ids;
}

void run_top_down(std::shared_ptr<ASTNode> T1, std::shared_ptr<ASTNode> T2, GumTreeContext& ctx, int min_height = 2) {
    std::vector<std::shared_ptr<ASTNode>> nodes1, nodes2;
    auto collect = [](auto& self, const std::shared_ptr<ASTNode>& n, std::vector<std::shared_ptr<ASTNode>>& out) -> void {
        out.push_back(n);
        for (auto& c : n->children) self(self, c, out);
    };
    collect(collect, T1, nodes1);
    collect(collect, T2, nodes2);
    
    int max_h = 0;
    for (auto& n : nodes1) max_h = std::max(max_h, n->height);
    for (auto& n : nodes2) max_h = std::max(max_h, n->height);
    
    for (int h = max_h; h >= min_height; h--) {
        std::vector<std::shared_ptr<ASTNode>> H1, H2;
        for (auto& n : nodes1) {
            if (n->height == h && ctx.A_to_B.count(n->id) == 0) H1.push_back(n);
        }
        for (auto& n : nodes2) {
            if (n->height == h && ctx.B_to_A.count(n->id) == 0) H2.push_back(n);
        }
        
        for (auto& n1 : H1) {
            if (ctx.A_to_B.count(n1->id) > 0) continue;
            for (auto& n2 : H2) {
                if (ctx.B_to_A.count(n2->id) > 0) continue;
                
                if (n1->structure_hash == n2->structure_hash) {
                    auto map_all = [&ctx](auto& self, const std::shared_ptr<ASTNode>& a, const std::shared_ptr<ASTNode>& b) -> void {
                        ctx.A_to_B[a->id] = b->id;
                        ctx.B_to_A[b->id] = a->id;
                        for (size_t i = 0; i < a->children.size() && i < b->children.size(); i++) {
                            self(self, a->children[i], b->children[i]);
                        }
                    };
                    map_all(map_all, n1, n2);
                    break;
                }
            }
        }
    }
}

double compute_similarity(int id1, int id2, GumTreeContext& ctx) {
    const auto& desc1 = ctx.descendants_A[id1];
    const auto& desc2 = ctx.descendants_B[id2];
    if (desc1.empty() && desc2.empty()) return 1.0;
    
    int intersection = 0;
    for (int d1 : desc1) {
        if (ctx.A_to_B.count(d1) > 0) {
            int d2 = ctx.A_to_B[d1];
            if (desc2.count(d2) > 0) {
                intersection++;
            }
        }
    }
    return 2.0 * intersection / (desc1.size() + desc2.size());
}

void run_bottom_up(std::shared_ptr<ASTNode> T1, std::shared_ptr<ASTNode> T2, GumTreeContext& ctx) {
    std::vector<std::shared_ptr<ASTNode>> post1;
    auto collect_post = [](auto& self, const std::shared_ptr<ASTNode>& n, std::vector<std::shared_ptr<ASTNode>>& out) -> void {
        for (auto& c : n->children) self(self, c, out);
        out.push_back(n);
    };
    collect_post(collect_post, T1, post1);
    
    std::vector<std::shared_ptr<ASTNode>> nodes2;
    auto collect_pre = [](auto& self, const std::shared_ptr<ASTNode>& n, std::vector<std::shared_ptr<ASTNode>>& out) -> void {
        out.push_back(n);
        for (auto& c : n->children) self(self, c, out);
    };
    collect_pre(collect_pre, T2, nodes2);

    for (auto& n1 : post1) {
        if (ctx.A_to_B.count(n1->id) > 0) continue;
        
        std::shared_ptr<ASTNode> best_candidate = nullptr;
        double max_sim = 0.0;
        
        for (auto& n2 : nodes2) {
            if (ctx.B_to_A.count(n2->id) > 0) continue;
            if (n1->type != n2->type) continue;
            
            double sim = compute_similarity(n1->id, n2->id, ctx);
            if (sim > max_sim) {
                max_sim = sim;
                best_candidate = n2;
            }
        }
        
        if (max_sim >= 0.5 && best_candidate != nullptr) {
            ctx.A_to_B[n1->id] = best_candidate->id;
            ctx.B_to_A[best_candidate->id] = n1->id;
            
            // Recovery matching of children
            for (auto& c1 : n1->children) {
                if (ctx.A_to_B.count(c1->id) > 0) continue;
                for (auto& c2 : best_candidate->children) {
                    if (ctx.B_to_A.count(c2->id) > 0) continue;
                    if (c1->type == c2->type && c1->value == c2->value) {
                        ctx.A_to_B[c1->id] = c2->id;
                        ctx.B_to_A[c2->id] = c1->id;
                        break;
                      }
                }
            }
        }
    }
    
    // Leaf matching recovery
    for (auto& n1 : post1) {
        if (ctx.A_to_B.count(n1->id) > 0) continue;
        if (!n1->children.empty()) continue;
        
        for (auto& n2 : nodes2) {
            if (ctx.B_to_A.count(n2->id) > 0) continue;
            if (!n2->children.empty()) continue;
            
            if (n1->type == n2->type && n1->value == n2->value) {
                ctx.A_to_B[n1->id] = n2->id;
                ctx.B_to_A[n2->id] = n1->id;
                break;
            }
        }
    }
}

std::vector<ASTDiffOp> generate_edit_script(
    std::shared_ptr<ASTNode> T1, std::shared_ptr<ASTNode> T2, GumTreeContext& ctx) {
    
    std::vector<ASTDiffOp> ops;
    
    std::vector<std::shared_ptr<ASTNode>> post1;
    auto collect_post = [](auto& self, const std::shared_ptr<ASTNode>& n, std::vector<std::shared_ptr<ASTNode>>& out) -> void {
        for (auto& c : n->children) self(self, c, out);
        out.push_back(n);
    };
    collect_post(collect_post, T1, post1);
    
    // Deletes (Post-order on T1)
    for (auto& n1 : post1) {
        if (ctx.A_to_B.count(n1->id) == 0) {
            ops.push_back({ASTOpType::DELETE, n1->id, n1->type, n1->value, "", -1, -1});
        }
    }
    
    // Pre-order on T2
    std::vector<std::shared_ptr<ASTNode>> pre2;
    auto collect_pre = [](auto& self, const std::shared_ptr<ASTNode>& n, std::vector<std::shared_ptr<ASTNode>>& out) -> void {
        out.push_back(n);
        for (auto& c : n->children) self(self, c, out);
    };
    collect_pre(collect_pre, T2, pre2);
    
    for (auto& n2 : pre2) {
        if (ctx.B_to_A.count(n2->id) > 0) {
            int n1_id = ctx.B_to_A[n2->id];
            auto n1 = ctx.nodes_A[n1_id];
            
            // Check Update
            if (n1->value != n2->value) {
                ops.push_back({ASTOpType::UPDATE, n1->id, n1->type, n1->value, n2->value, -1, -1});
            }
            
            // Check Move
            if (n2->parent.lock() != nullptr && n1->parent.lock() != nullptr) {
                auto p2 = n2->parent.lock();
                auto p1 = n1->parent.lock();
                
                int expected_p1_id = ctx.B_to_A.count(p2->id) > 0 ? ctx.B_to_A[p2->id] : -1;
                
                int pos_in_p2 = 0;
                for (size_t i = 0; i < p2->children.size(); i++) {
                    if (p2->children[i]->id == n2->id) {
                        pos_in_p2 = i;
                        break;
                    }
                }
                
                int pos_in_p1 = -1;
                for (size_t i = 0; i < p1->children.size(); i++) {
                    if (p1->children[i]->id == n1->id) {
                        pos_in_p1 = i;
                        break;
                    }
                }
                
                if (p1->id != expected_p1_id || pos_in_p1 != pos_in_p2) {
                    ops.push_back({ASTOpType::MOVE, n1->id, n1->type, "", "", expected_p1_id, pos_in_p2});
                }
            }
        } else {
            // Insert
            auto p2 = n2->parent.lock();
            int parent1_id = -1;
            if (p2) {
                parent1_id = ctx.B_to_A.count(p2->id) > 0 ? ctx.B_to_A[p2->id] : -1;
            }
            
            int pos_in_p2 = 0;
            if (p2) {
                for (size_t i = 0; i < p2->children.size(); i++) {
                    if (p2->children[i]->id == n2->id) {
                        pos_in_p2 = i;
                        break;
                    }
                }
            }
            
            ops.push_back({ASTOpType::INSERT, n2->id, n2->type, "", n2->value, parent1_id, pos_in_p2});
            ctx.B_to_A[n2->id] = n2->id; // Map inserted node
        }
    }
    
    return ops;
}

std::vector<ASTDiffOp> gumtree_diff(std::shared_ptr<ASTNode> T1, std::shared_ptr<ASTNode> T2) {
    GumTreeContext ctx;
    
    cache_descendants(T1, ctx.descendants_A, ctx.nodes_A);
    cache_descendants(T2, ctx.descendants_B, ctx.nodes_B);
    
    // Step 1: Top-down matching
    run_top_down(T1, T2, ctx, 2);
    
    // Step 2: Bottom-up matching
    run_bottom_up(T1, T2, ctx);
    
    // Step 3: Generate edit script
    return generate_edit_script(T1, T2, ctx);
}
