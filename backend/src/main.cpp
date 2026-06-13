#include "diff_core.h"
#include "ast.h"
#include <fstream>
#include <iostream>
#include <sstream>

// Declarations of diff functions from other files
std::vector<LineDiff> myers_diff(const std::vector<std::string>& A, const std::vector<std::string>& B);
std::vector<LineDiff> histogram_diff(const std::vector<std::string>& A, const std::vector<std::string>& B);
std::vector<ASTDiffOp> gumtree_diff(std::shared_ptr<ASTNode> T1, std::shared_ptr<ASTNode> T2);

std::vector<std::string> read_lines(const std::string& path) {
    std::vector<std::string> lines;
    std::ifstream file(path);
    if (!file.is_open()) return lines;
    std::string line;
    while (std::getline(file, line)) {
        lines.push_back(line);
    }
    return lines;
}

std::string read_full_text(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) return "";
    std::ostringstream ss;
    ss << file.rdbuf();
    return ss.str();
}

int main(int argc, char* argv[]) {
    if (argc < 4) {
        std::cerr << "Usage: " << argv[0] << " <algorithm> <fileA> <fileB>\n";
        return 1;
    }
    
    std::string algo = argv[1];
    std::string fileA = argv[2];
    std::string fileB = argv[3];
    
    if (algo == "myers" || algo == "histogram") {
        auto A = read_lines(fileA);
        auto B = read_lines(fileB);
        
        std::vector<LineDiff> diff;
        if (algo == "myers") {
            diff = myers_diff(A, B);
        } else {
            diff = histogram_diff(A, B);
        }
        
        // Print as JSON
        std::cout << "{\n";
        std::cout << "  \"algorithm\": \"" << algo << "\",\n";
        std::cout << "  \"diff\": [\n";
        for (size_t i = 0; i < diff.size(); i++) {
            std::cout << "    {\n";
            std::cout << "      \"type\": \"" << (diff[i].type == LineOpType::EQUAL ? "equal" : (diff[i].type == LineOpType::DELETE ? "delete" : "insert")) << "\",\n";
            std::cout << "      \"line\": \"" << escapeJSON(diff[i].line) << "\",\n";
            std::cout << "      \"lineNoA\": " << diff[i].lineNoA << ",\n";
            std::cout << "      \"lineNoB\": " << diff[i].lineNoB << "\n";
            std::cout << "    }" << (i + 1 < diff.size() ? "," : "") << "\n";
        }
        std::cout << "  ]\n";
        std::cout << "}\n";
        
    } else if (algo == "gumtree") {
        std::string textA = read_full_text(fileA);
        std::string textB = read_full_text(fileB);
        
        auto T1 = build_ast(textA);
        auto T2 = build_ast(textB);
        
        auto diff = gumtree_diff(T1, T2);
        
        // Print as JSON
        std::cout << "{\n";
        std::cout << "  \"algorithm\": \"gumtree\",\n";
        std::cout << "  \"treeA\": " << T1->to_json() << ",\n";
        std::cout << "  \"treeB\": " << T2->to_json() << ",\n";
        std::cout << "  \"diff\": [\n";
        for (size_t i = 0; i < diff.size(); i++) {
            std::cout << "    {\n";
            std::string type_str;
            switch (diff[i].type) {
                case ASTOpType::INSERT: type_str = "insert"; break;
                case ASTOpType::DELETE: type_str = "delete"; break;
                case ASTOpType::UPDATE: type_str = "update"; break;
                case ASTOpType::MOVE:   type_str = "move"; break;
            }
            std::cout << "      \"type\": \"" << type_str << "\",\n";
            std::cout << "      \"nodeId\": " << diff[i].nodeId << ",\n";
            std::cout << "      \"nodeType\": \"" << escapeJSON(diff[i].nodeType) << "\",\n";
            std::cout << "      \"oldValue\": \"" << escapeJSON(diff[i].oldValue) << "\",\n";
            std::cout << "      \"newValue\": \"" << escapeJSON(diff[i].newValue) << "\",\n";
            std::cout << "      \"parentId\": " << diff[i].parentId << ",\n";
            std::cout << "      \"pos\": " << diff[i].pos << "\n";
            std::cout << "    }" << (i + 1 < diff.size() ? "," : "") << "\n";
        }
        std::cout << "  ]\n";
        std::cout << "}\n";
    } else {
        std::cerr << "Unknown algorithm: " << algo << "\n";
        return 1;
    }
    
    return 0;
}
