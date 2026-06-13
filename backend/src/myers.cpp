#include "diff_core.h"

std::vector<LineDiff> myers_diff(const std::vector<std::string>& A, const std::vector<std::string>& B) {
    int N = A.size();
    int M = B.size();
    int MAX = N + M;
    
    if (MAX == 0) return std::vector<LineDiff>();

    // V maps k -> x coordinate. k is from -MAX to MAX.
    // To index easily, we can use an offset of MAX, so index is k + MAX.
    std::vector<std::vector<int>> history;
    std::vector<int> V(2 * MAX + 1, 0);
    
    int x = 0, y = 0;
    bool found = false;
    int target_d = 0;
    
    for (int d = 0; d <= MAX; d++) {
        history.push_back(V);
        for (int k = -d; k <= d; k += 2) {
            int idx = k + MAX;
            int prev_idx_down = idx - 1; // coming from k-1 (down, i.e., insertion)
            int prev_idx_right = idx + 1; // coming from k+1 (right, i.e., deletion)
            
            // Determine if we move down or right
            bool move_down = (k == -d || (k != d && V[prev_idx_down] < V[prev_idx_right]));
            
            int prev_k = move_down ? (k + 1) : (k - 1);
            int prev_idx = prev_k + MAX;
            
            int start_x = V[prev_idx];
            int current_x = move_down ? start_x : (start_x + 1);
            int current_y = current_x - k;
            
            // Keep track of the diagonal steps
            while (current_x < N && current_y < M && A[current_x] == B[current_y]) {
                current_x++;
                current_y++;
            }
            
            V[idx] = current_x;
            
            if (current_x >= N && current_y >= M) {
                target_d = d;
                found = true;
                break;
            }
        }
        if (found) break;
    }
    
    // Trace back the path
    std::vector<std::pair<int, int>> path;
    int curr_k = N - M;
    x = N;
    y = M;
    path.push_back({x, y});
    
    for (int d = target_d; d > 0; d--) {
        int idx = curr_k + MAX;
        std::vector<int>& prev_V = history[d];
        
        int prev_idx_down = idx - 1;
        int prev_idx_right = idx + 1;
        
        bool move_down = (curr_k == -d || (curr_k != d && prev_V[prev_idx_down] < prev_V[prev_idx_right]));
        
        int prev_k = move_down ? (curr_k + 1) : (curr_k - 1);
        int prev_idx = prev_k + MAX;
        
        int next_x = prev_V[prev_idx];
        int next_y = next_x - prev_k;
        
        // Before matching diagonals, we came from (next_x, next_y)
        // Let's add intermediate points on the diagonal
        while (x > next_x && y > next_y && A[x - 1] == B[y - 1]) {
            x--;
            y--;
            path.push_back({x, y});
        }
        
        x = next_x;
        y = next_y;
        path.push_back({x, y});
        
        curr_k = prev_k;
    }
    
    while (x > 0 && y > 0 && A[x - 1] == B[y - 1]) {
        x--;
        y--;
        path.push_back({x, y});
    }
    if (x > 0 || y > 0) {
        path.push_back({0, 0});
    }
    
    std::reverse(path.begin(), path.end());
    
    // Convert the path of points into edit operations
    std::vector<LineDiff> diff;
    for (size_t i = 1; i < path.size(); i++) {
        int px = path[i-1].first;
        int py = path[i-1].second;
        int cx = path[i].first;
        int cy = path[i].second;
        
        if (cx == px + 1 && cy == py + 1) {
            diff.push_back({LineOpType::EQUAL, A[px], px + 1, py + 1});
        } else if (cx == px + 1 && cy == py) {
            diff.push_back({LineOpType::DELETE, A[px], px + 1, 0});
        } else if (cx == px && cy == py + 1) {
            diff.push_back({LineOpType::INSERT, B[py], 0, py + 1});
        }
    }
    return diff;
}
