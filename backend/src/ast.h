#ifndef AST_H
#define AST_H

#include "diff_core.h"
#include <memory>
#include <string>
#include <vector>

struct ASTNode : public std::enable_shared_from_this<ASTNode> {
    int id;
    std::string type;
    std::string value;
    std::vector<std::shared_ptr<ASTNode>> children;
    std::weak_ptr<ASTNode> parent;

    // Cached properties for GumTree
    int height;
    int size;
    std::string structure_hash;

    ASTNode(int id, const std::string& type, const std::string& value)
        : id(id), type(type), value(value), height(1), size(1) {}

    // Utility to update height, size, parent pointers, and hashes recursively
    void post_process();
    
    // Convert subtree to JSON
    std::string to_json() const;
};

// Parser interfaces
std::shared_ptr<ASTNode> parse_sexpr(const std::string& input, int& next_id);
std::shared_ptr<ASTNode> parse_toy_code(const std::string& input, int& next_id);
std::shared_ptr<ASTNode> build_ast(const std::string& input);

#endif // AST_H
