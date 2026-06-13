#ifndef DIFF_CORE_H
#define DIFF_CORE_H

#include <string>
#include <vector>
#include <iostream>
#include <memory>
#include <map>
#include <unordered_map>
#include <set>
#include <algorithm>
#include <sstream>
#include <iomanip>

// Operations for Line Diffing (Myers and Histogram)
enum class LineOpType {
    EQUAL,
    DELETE,
    INSERT
};

struct LineDiff {
    LineOpType type;
    std::string line;
    int lineNoA; // 1-based index in file A (0 if not present)
    int lineNoB; // 1-based index in file B (0 if not present)
};

// Operations for AST Diffing (GumTree)
enum class ASTOpType {
    INSERT,
    DELETE,
    UPDATE,
    MOVE
};

struct ASTDiffOp {
    ASTOpType type;
    int nodeId;         // ID of the target node
    std::string nodeType; // Name/type of the node (e.g., "Function", "VarDecl")
    std::string oldValue; // Old value (for UPDATE)
    std::string newValue; // New value (for UPDATE / INSERT)
    int parentId;       // Parent node ID (for INSERT / MOVE)
    int pos;            // Position index in parent's children (for INSERT / MOVE)
};

// Utility to escape JSON strings
inline std::string escapeJSON(const std::string& s) {
    std::ostringstream o;
    for (auto c = s.cbegin(); c != s.cend(); c++) {
        switch (*c) {
        case '"': o << "\\\""; break;
        case '\\': o << "\\\\"; break;
        case '\b': o << "\\b"; break;
        case '\f': o << "\\f"; break;
        case '\n': o << "\\n"; break;
        case '\r': o << "\\r"; break;
        case '\t': o << "\\t"; break;
        default:
            if ('\x00' <= *c && *c <= '\x1f') {
                o << "\\u"
                  << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(*c);
            } else {
                o << *c;
            }
        }
    }
    return o.str();
}

#endif // DIFF_CORE_H
