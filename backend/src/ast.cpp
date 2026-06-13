#include "ast.h"
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <cctype>

void ASTNode::post_process() {
    size = 1;
    int max_child_height = 0;
    
    std::string s = type + ":" + value + "[";
    for (auto& child : children) {
        child->parent = shared_from_this();
        child->post_process();
        size += child->size;
        max_child_height = std::max(max_child_height, child->height);
        s += child->structure_hash + ",";
    }
    s += "]";
    
    height = 1 + max_child_height;
    structure_hash = s;
}

std::string ASTNode::to_json() const {
    std::ostringstream ss;
    ss << "{"
       << "\"id\":" << id << ","
       << "\"type\":\"" << escapeJSON(type) << "\","
       << "\"value\":\"" << escapeJSON(value) << "\","
       << "\"children\":[";
    for (size_t i = 0; i < children.size(); i++) {
        if (i > 0) ss << ",";
        ss << children[i]->to_json();
    }
    ss << "]}";
    return ss.str();
}

// Tokenize Lisp-like S-expressions
std::vector<std::string> tokenize_sexpr(const std::string& input) {
    std::vector<std::string> tokens;
    size_t i = 0;
    while (i < input.size()) {
        if (isspace(input[i])) {
            i++;
            continue;
        }
        if (input[i] == '(') {
            tokens.push_back("(");
            i++;
        } else if (input[i] == ')') {
            tokens.push_back(")");
            i++;
        } else if (input[i] == '"') {
            std::string str = "";
            i++;
            while (i < input.size() && input[i] != '"') {
                if (input[i] == '\\' && i + 1 < input.size()) {
                    str += input[i+1];
                    i += 2;
                } else {
                    str += input[i];
                    i++;
                }
            }
            if (i < input.size()) i++;
            tokens.push_back("\"" + str + "\"");
        } else {
            std::string word = "";
            while (i < input.size() && !isspace(input[i]) && input[i] != '(' && input[i] != ')') {
                word += input[i];
                i++;
            }
            tokens.push_back(word);
        }
    }
    return tokens;
}

std::shared_ptr<ASTNode> parse_sexpr_tokens(const std::vector<std::string>& tokens, size_t& index, int& next_id) {
    if (index >= tokens.size()) return nullptr;
    
    if (tokens[index] != "(") {
        std::string val = tokens[index];
        if (val.front() == '"' && val.back() == '"') {
            val = val.substr(1, val.size() - 2);
        }
        index++;
        return std::make_shared<ASTNode>(next_id++, "Literal", val);
    }
    
    index++; // skip '('
    if (index >= tokens.size()) return nullptr;
    
    std::string type = tokens[index++];
    std::string value = "";
    
    if (index < tokens.size() && tokens[index] != "(" && tokens[index] != ")") {
        value = tokens[index++];
        if (value.front() == '"' && value.back() == '"') {
            value = value.substr(1, value.size() - 2);
        }
    }
    
    auto node = std::make_shared<ASTNode>(next_id++, type, value);
    
    while (index < tokens.size() && tokens[index] != ")") {
        auto child = parse_sexpr_tokens(tokens, index, next_id);
        if (child) {
            node->children.push_back(child);
        }
    }
    
    if (index < tokens.size()) {
        index++; // skip ')'
    }
    return node;
}

std::shared_ptr<ASTNode> parse_sexpr(const std::string& input, int& next_id) {
    auto tokens = tokenize_sexpr(input);
    size_t index = 0;
    return parse_sexpr_tokens(tokens, index, next_id);
}

// Simple Toy C-like Language Tokenizer
struct ToyToken {
    std::string type; // "KEYWORD", "IDENTIFIER", "NUMBER", "STRING", "OPERATOR", "PUNCTUATION"
    std::string value;
};

std::vector<ToyToken> tokenize_toy(const std::string& input) {
    std::vector<ToyToken> tokens;
    size_t i = 0;
    while (i < input.size()) {
        if (isspace(input[i])) {
            i++;
            continue;
        }
        if (input[i] == '/' && i + 1 < input.size() && input[i+1] == '/') {
            i += 2;
            while (i < input.size() && input[i] != '\n') i++;
            continue;
        }
        
        if (input[i] == '(' || input[i] == ')' || input[i] == '{' || input[i] == '}' || input[i] == ';' || input[i] == ',') {
            tokens.push_back({"PUNCTUATION", std::string(1, input[i])});
            i++;
            continue;
        }
        
        if (input[i] == '"') {
            std::string str = "";
            i++;
            while (i < input.size() && input[i] != '"') {
                if (input[i] == '\\' && i + 1 < input.size()) {
                    str += input[i+1];
                    i += 2;
                } else {
                    str += input[i];
                    i++;
                }
            }
            if (i < input.size()) i++;
            tokens.push_back({"STRING", str});
            continue;
        }
        
        if (isdigit(input[i])) {
            std::string num = "";
            while (i < input.size() && isdigit(input[i])) {
                num += input[i];
                i++;
            }
            tokens.push_back({"NUMBER", num});
            continue;
        }
        
        if (i + 1 < input.size()) {
            std::string two = input.substr(i, 2);
            if (two == "==" || two == "!=" || two == "<=" || two == ">=") {
                tokens.push_back({"OPERATOR", two});
                i += 2;
                continue;
            }
        }
        
        if (input[i] == '+' || input[i] == '-' || input[i] == '*' || input[i] == '/' || input[i] == '<' || input[i] == '>' || input[i] == '=') {
            tokens.push_back({"OPERATOR", std::string(1, input[i])});
            i++;
            continue;
        }
        
        if (isalpha(input[i]) || input[i] == '_') {
            std::string id = "";
            while (i < input.size() && (isalnum(input[i]) || input[i] == '_')) {
                id += input[i];
                i++;
            }
            if (id == "function" || id == "var" || id == "let" || id == "if" || id == "else" || id == "while" || id == "return") {
                tokens.push_back({"KEYWORD", id});
            } else {
                tokens.push_back({"IDENTIFIER", id});
            }
            continue;
        }
        
        i++;
    }
    return tokens;
}

class ToyParser {
    std::vector<ToyToken> tokens;
    size_t index;
    int& next_id;

    bool is_at_end() { return index >= tokens.size(); }
    ToyToken peek() { return is_at_end() ? ToyToken{"EOF", ""} : tokens[index]; }
    ToyToken advance() { if (!is_at_end()) index++; return tokens[index-1]; }
    bool check(const std::string& type, const std::string& val = "") {
        if (is_at_end()) return false;
        if (tokens[index].type != type) return false;
        if (val != "" && tokens[index].value != val) return false;
        return true;
    }
    bool match(const std::string& type, const std::string& val = "") {
        if (check(type, val)) {
            advance();
            return true;
        }
        return false;
    }

public:
    ToyParser(const std::vector<ToyToken>& tokens, int& next_id)
        : tokens(tokens), index(0), next_id(next_id) {}

    std::shared_ptr<ASTNode> parse() {
        auto root = std::make_shared<ASTNode>(next_id++, "Program", "");
        while (!is_at_end()) {
            auto stmt = parse_statement();
            if (stmt) root->children.push_back(stmt);
            else advance();
        }
        return root;
    }

    std::shared_ptr<ASTNode> parse_statement() {
        if (match("KEYWORD", "function")) {
            return parse_function_decl();
        }
        if (match("KEYWORD", "var") || match("KEYWORD", "let")) {
            return parse_var_decl();
        }
        if (match("KEYWORD", "if")) {
            return parse_if_statement();
        }
        if (match("KEYWORD", "while")) {
            return parse_while_statement();
        }
        if (match("KEYWORD", "return")) {
            return parse_return_statement();
        }
        
        if (check("IDENTIFIER") && index + 1 < tokens.size() && tokens[index+1].type == "OPERATOR" && tokens[index+1].value == "=") {
            std::string name = advance().value;
            advance(); // consume '='
            auto expr = parse_expression();
            match("PUNCTUATION", ";");
            auto node = std::make_shared<ASTNode>(next_id++, "Assign", name);
            if (expr) node->children.push_back(expr);
            return node;
        }
        
        auto expr = parse_expression();
        match("PUNCTUATION", ";");
        return expr;
    }

    std::shared_ptr<ASTNode> parse_function_decl() {
        if (!check("IDENTIFIER")) return nullptr;
        std::string name = advance().value;
        auto func = std::make_shared<ASTNode>(next_id++, "FunctionDecl", name);
        
        if (match("PUNCTUATION", "(")) {
            auto params = std::make_shared<ASTNode>(next_id++, "Parameters", "");
            while (!check("PUNCTUATION", ")") && !is_at_end()) {
                if (check("IDENTIFIER")) {
                    params->children.push_back(std::make_shared<ASTNode>(next_id++, "Identifier", advance().value));
                } else {
                    advance();
                }
                match("PUNCTUATION", ",");
            }
            match("PUNCTUATION", ")");
            func->children.push_back(params);
        }
        
        auto body = parse_block();
        if (body) func->children.push_back(body);
        return func;
    }

    std::shared_ptr<ASTNode> parse_block() {
        if (!match("PUNCTUATION", "{")) return nullptr;
        auto block = std::make_shared<ASTNode>(next_id++, "Block", "");
        while (!check("PUNCTUATION", "}") && !is_at_end()) {
            auto stmt = parse_statement();
            if (stmt) block->children.push_back(stmt);
            else advance();
        }
        match("PUNCTUATION", "}");
        return block;
    }

    std::shared_ptr<ASTNode> parse_var_decl() {
        if (!check("IDENTIFIER")) return nullptr;
        std::string name = advance().value;
        auto decl = std::make_shared<ASTNode>(next_id++, "VarDecl", name);
        
        if (match("OPERATOR", "=")) {
            auto expr = parse_expression();
            if (expr) decl->children.push_back(expr);
        }
        match("PUNCTUATION", ";");
        return decl;
    }

    std::shared_ptr<ASTNode> parse_if_statement() {
        auto node = std::make_shared<ASTNode>(next_id++, "IfStatement", "");
        
        if (match("PUNCTUATION", "(")) {
            auto cond = parse_expression();
            if (cond) node->children.push_back(cond);
            match("PUNCTUATION", ")");
        }
        
        auto then_branch = check("PUNCTUATION", "{") ? parse_block() : parse_statement();
        if (then_branch) node->children.push_back(then_branch);
        
        if (match("KEYWORD", "else")) {
            auto else_branch = check("PUNCTUATION", "{") ? parse_block() : parse_statement();
            if (else_branch) node->children.push_back(else_branch);
        }
        
        return node;
    }

    std::shared_ptr<ASTNode> parse_while_statement() {
        auto node = std::make_shared<ASTNode>(next_id++, "WhileStatement", "");
        if (match("PUNCTUATION", "(")) {
            auto cond = parse_expression();
            if (cond) node->children.push_back(cond);
            match("PUNCTUATION", ")");
        }
        auto body = check("PUNCTUATION", "{") ? parse_block() : parse_statement();
        if (body) node->children.push_back(body);
        return node;
    }

    std::shared_ptr<ASTNode> parse_return_statement() {
        auto node = std::make_shared<ASTNode>(next_id++, "ReturnStatement", "");
        if (!check("PUNCTUATION", ";")) {
            auto expr = parse_expression();
            if (expr) node->children.push_back(expr);
        }
        match("PUNCTUATION", ";");
        return node;
    }

    std::shared_ptr<ASTNode> parse_expression() {
        return parse_binary_expr(0);
    }

    int get_precedence(const std::string& op) {
        if (op == "==" || op == "!=" || op == "<" || op == ">" || op == "<=" || op == ">=") return 1;
        if (op == "+" || op == "-") return 2;
        if (op == "*" || op == "/") return 3;
        return -1;
    }

    std::shared_ptr<ASTNode> parse_binary_expr(int parent_precedence) {
        auto left = parse_primary();
        if (!left) return nullptr;

        while (true) {
            if (is_at_end() || tokens[index].type != "OPERATOR") break;
            std::string op = tokens[index].value;
            int precedence = get_precedence(op);
            if (precedence == -1 || precedence <= parent_precedence) break;

            advance();
            auto right = parse_binary_expr(precedence);
            auto new_left = std::make_shared<ASTNode>(next_id++, "BinaryExpr", op);
            new_left->children.push_back(left);
            if (right) new_left->children.push_back(right);
            left = new_left;
        }
        return left;
    }

    std::shared_ptr<ASTNode> parse_primary() {
        if (check("NUMBER")) {
            return std::make_shared<ASTNode>(next_id++, "Literal", advance().value);
        }
        if (check("STRING")) {
            return std::make_shared<ASTNode>(next_id++, "Literal", advance().value);
        }
        if (check("IDENTIFIER")) {
            return std::make_shared<ASTNode>(next_id++, "Identifier", advance().value);
        }
        if (match("PUNCTUATION", "(")) {
            auto expr = parse_expression();
            match("PUNCTUATION", ")");
            return expr;
        }
        return nullptr;
    }
};

std::shared_ptr<ASTNode> parse_toy_code(const std::string& input, int& next_id) {
    auto tokens = tokenize_toy(input);
    if (tokens.empty()) return nullptr;
    ToyParser parser(tokens, next_id);
    return parser.parse();
}

std::shared_ptr<ASTNode> parse_fallback_text(const std::string& input, int& next_id) {
    auto root = std::make_shared<ASTNode>(next_id++, "Program", "");
    std::istringstream iss(input);
    std::string line;
    while (std::getline(iss, line)) {
        if (line.empty()) continue;
        auto lineNode = std::make_shared<ASTNode>(next_id++, "Line", "");
        
        std::istringstream line_iss(line);
        std::string word;
        while (line_iss >> word) {
            lineNode->children.push_back(std::make_shared<ASTNode>(next_id++, "Word", word));
        }
        root->children.push_back(lineNode);
    }
    return root;
}

std::shared_ptr<ASTNode> build_ast(const std::string& input) {
    int next_id = 1;
    std::shared_ptr<ASTNode> root;
    
    size_t first_non_space = input.find_first_not_of(" \t\n\r");
    if (first_non_space != std::string::npos && input[first_non_space] == '(') {
        root = parse_sexpr(input, next_id);
    } else {
        root = parse_toy_code(input, next_id);
    }
    
    if (!root || root->children.empty()) {
        next_id = 1;
        root = parse_fallback_text(input, next_id);
    }
    
    if (root) {
        root->post_process();
    }
    return root;
}
