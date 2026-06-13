#include "diff_core.h"
#include <cmath>

// Forward declaration of Myers diff
std::vector<LineDiff> myers_diff(const std::vector<std::string>& A, const std::vector<std::string>& B);

void histogram_diff_recursive(
    const std::vector<std::string>& A, int sa, int ea,
    const std::vector<std::string>& B, int sb, int eb,
    std::vector<LineDiff>& result) 
{
    // Skip common prefix
    while (sa < ea && sb < eb && A[sa] == B[sb]) {
        result.push_back({LineOpType::EQUAL, A[sa], sa + 1, sb + 1});
        sa++;
        sb++;
    }

    // Skip common suffix (collect and append at the end)
    std::vector<LineDiff> suffix_diffs;
    while (sa < ea && sb < eb && A[ea - 1] == B[eb - 1]) {
        suffix_diffs.push_back({LineOpType::EQUAL, A[ea - 1], ea, eb});
        ea--;
        eb--;
    }

    // Base cases
    if (sa == ea) {
        // All elements left in B are insertions
        for (int i = sb; i < eb; i++) {
            result.push_back({LineOpType::INSERT, B[i], 0, i + 1});
        }
        // Append suffix
        for (auto it = suffix_diffs.rbegin(); it != suffix_diffs.rend(); ++it) {
            result.push_back(*it);
        }
        return;
    }
    if (sb == eb) {
        // All elements left in A are deletions
        for (int i = sa; i < ea; i++) {
            result.push_back({LineOpType::DELETE, A[i], i + 1, 0});
        }
        // Append suffix
        for (auto it = suffix_diffs.rbegin(); it != suffix_diffs.rend(); ++it) {
            result.push_back(*it);
        }
        return;
    }

    // Count occurrences of lines in A
    std::unordered_map<std::string, std::vector<int>> occurrences_in_A;
    for (int i = sa; i < ea; i++) {
        occurrences_in_A[A[i]].push_back(i);
    }

    // Count occurrences of lines in B
    std::unordered_map<std::string, std::vector<int>> occurrences_in_B;
    for (int j = sb; j < eb; j++) {
        occurrences_in_B[B[j]].push_back(j);
    }

    // Find the common line with the lowest occurrence in A (histogram diff strategy)
    std::string rarest_line = "";
    int min_occurrence = -1;
    int min_occurrence_B = -1;

    for (const auto& pair : occurrences_in_A) {
        const std::string& line = pair.first;
        if (occurrences_in_B.count(line) > 0) {
            int countA = pair.second.size();
            int countB = occurrences_in_B[line].size();
            
            if (min_occurrence == -1 || countA < min_occurrence || (countA == min_occurrence && countB < min_occurrence_B)) {
                min_occurrence = countA;
                min_occurrence_B = countB;
                rarest_line = line;
            }
        }
    }

    // If no common lines are found, fallback to Myers diff
    if (min_occurrence == -1) {
        std::vector<std::string> subA(A.begin() + sa, A.begin() + ea);
        std::vector<std::string> subB(B.begin() + sb, B.begin() + eb);
        std::vector<LineDiff> fallback = myers_diff(subA, subB);
        
        for (auto& d : fallback) {
            if (d.lineNoA > 0) d.lineNoA += sa;
            if (d.lineNoB > 0) d.lineNoB += sb;
            result.push_back(d);
        }
    } else {
        // Find the best matching pair based on relative position
        int best_i = -1;
        int best_j = -1;
        double min_rel_diff = 2.0;

        const std::vector<int>& idxsA = occurrences_in_A[rarest_line];
        const std::vector<int>& idxsB = occurrences_in_B[rarest_line];

        for (int i : idxsA) {
            for (int j : idxsB) {
                double relA = (double)(i - sa) / (ea - sa);
                double relB = (double)(j - sb) / (eb - sb);
                double rel_diff = std::abs(relA - relB);
                if (rel_diff < min_rel_diff) {
                    min_rel_diff = rel_diff;
                    best_i = i;
                    best_j = j;
                }
            }
        }

        // Recursively solve left of the pivot
        histogram_diff_recursive(A, sa, best_i, B, sb, best_j, result);

        // Add the pivot
        result.push_back({LineOpType::EQUAL, rarest_line, best_i + 1, best_j + 1});

        // Recursively solve right of the pivot
        histogram_diff_recursive(A, best_i + 1, ea, B, best_j + 1, eb, result);
    }

    // Append suffix in correct order
    for (auto it = suffix_diffs.rbegin(); it != suffix_diffs.rend(); ++it) {
        result.push_back(*it);
    }
}

std::vector<LineDiff> histogram_diff(const std::vector<std::string>& A, const std::vector<std::string>& B) {
    std::vector<LineDiff> result;
    histogram_diff_recursive(A, 0, A.size(), B, 0, B.size(), result);
    return result;
}
