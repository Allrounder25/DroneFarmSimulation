import heapq
import math

def find_path(grid_data, start, goal):
    """
    Finds the shortest path using the A* algorithm.
    grid_data is a 2D list of objects, e.g., grid[y][x]
    start and goal are dicts: {'x': 0, 'y': 0}
    """
    
    def get_neighbors(pos, rows, cols):
        neighbors = []
        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            nx, ny = pos['x'] + dx, pos['y'] + dy
            if 0 <= nx < cols and 0 <= ny < rows:
                neighbors.append({'x': nx, 'y': ny})
        return neighbors

    def get_cost(grid_data, pos):
        try:
            block_type = grid_data[pos['y']][pos['x']]['type']
            if block_type in ['stone', 'truck']:
                return float('inf')
            return 1
        except (IndexError, TypeError):
            return float('inf')

    def heuristic(a, b):
        return abs(a['x'] - b['x']) + abs(a['y'] - b['y'])

    rows = len(grid_data)
    cols = len(grid_data[0]) if rows > 0 else 0
    if not (0 <= start['x'] < cols and 0 <= start['y'] < rows and
            0 <= goal['x'] < cols and 0 <= goal['y'] < rows):
        return None

    open_set = []
    heapq.heappush(open_set, (0, tuple(start.items())))
    
    came_from = {}
    g_score = {tuple(start.items()): 0}
    f_score = {tuple(start.items()): heuristic(start, goal)}

    while open_set:
        _, current_tuple = heapq.heappop(open_set)
        current = dict(current_tuple)

        if current == goal:
            path = []
            temp_current_tuple = current_tuple
            while temp_current_tuple in came_from:
                path.append(dict(temp_current_tuple))
                temp_current_tuple = came_from[temp_current_tuple]
            path.append(start)
            return path[::-1]

        for neighbor in get_neighbors(current, rows, cols):
            cost = get_cost(grid_data, neighbor)
            if cost == float('inf'):
                continue

            tentative_g_score = g_score[current_tuple] + cost
            neighbor_tuple = tuple(neighbor.items())

            if neighbor_tuple not in g_score or tentative_g_score < g_score[neighbor_tuple]:
                came_from[neighbor_tuple] = current_tuple
                g_score[neighbor_tuple] = tentative_g_score
                f_score[neighbor_tuple] = tentative_g_score + heuristic(neighbor, goal)
                
                if neighbor_tuple not in [i[1] for i in open_set]:
                    heapq.heappush(open_set, (f_score[neighbor_tuple], neighbor_tuple))

    return None

def find_path_scan(grid_data, start):
    """
    Generates a serpentine path to cover the entire grid and returns to the start.
    """
    rows = len(grid_data)
    cols = len(grid_data[0]) if rows > 0 else 0
    path = [start]
    
    # Simple serpentine path
    for y in range(rows):
        if y % 2 == 0: # Left to right
            for x in range(cols):
                if {'x': x, 'y': y} != path[-1]:
                    path.append({'x': x, 'y': y})
        else: # Right to left
            for x in range(cols - 1, -1, -1):
                if {'x': x, 'y': y} != path[-1]:
                    path.append({'x': x, 'y': y})

    # Find a path from the end of the scan back to the start
    scan_end_pos = path[-1]
    return_path = find_path(grid_data, scan_end_pos, start)
    
    if return_path:
        path.extend(return_path[1:])
    
    return path

def find_path_multi_goal(grid_data, start, goals):
    """
    Finds a path from start to all goals using a greedy nearest-neighbor approach,
    then returns to the start.
    """
    if not goals:
        return [start]

    unvisited_goals = [tuple(g.items()) for g in goals]
    path = []
    current_pos = start

    while unvisited_goals:
        # Find the nearest goal from the current position
        nearest_goal_tuple = None
        shortest_path_to_goal = None
        
        for goal_tuple in unvisited_goals:
            goal = dict(goal_tuple)
            sub_path = find_path(grid_data, current_pos, goal)
            if sub_path and (shortest_path_to_goal is None or len(sub_path) < len(shortest_path_to_goal)):
                shortest_path_to_goal = sub_path
                nearest_goal_tuple = goal_tuple

        if not shortest_path_to_goal:
            return None # No path to any of the remaining goals

        # Add the path to the nearest goal (excluding the start point of the subpath)
        path.extend(shortest_path_to_goal[1:])
        current_pos = dict(nearest_goal_tuple)
        unvisited_goals.remove(nearest_goal_tuple)

    # Finally, find path from the last goal back to the original start
    return_path = find_path(grid_data, current_pos, start)
    if return_path:
        path.extend(return_path[1:])
    
    # The full path starts with the initial position
    return [start] + path

def find_path_tsp_nearest_neighbor(grid_data, start, goals):
    """
    Approximates the TSP solution using the nearest neighbor heuristic.
    Finds a path from the start to all goals and returns to the start.
    """
    if not goals:
        return [start]

    # Create a list of all points to visit, including the start
    all_points = {tuple(start.items()): "start"}
    for g in goals:
        all_points[tuple(g.items())] = "goal"

    # Pre-calculate all-pairs shortest paths
    point_keys = list(all_points.keys())
    path_cache = {}
    for i in range(len(point_keys)):
        for j in range(i, len(point_keys)):
            p1_tuple = point_keys[i]
            p2_tuple = point_keys[j]
            p1 = dict(p1_tuple)
            p2 = dict(p2_tuple)
            
            path = find_path(grid_data, p1, p2)
            path_cache[(p1_tuple, p2_tuple)] = path
            if path:
                # Paths are not necessarily symmetrical
                path_reversed = find_path(grid_data, p2, p1)
                path_cache[(p2_tuple, p1_tuple)] = path_reversed

    # Nearest neighbor tour construction
    unvisited = set(g_tuple for g_tuple in all_points if all_points[g_tuple] == "goal")
    
    full_path = []
    current_pos_tuple = tuple(start.items())

    while unvisited:
        nearest_neighbor = None
        shortest_path_segment = None

        for neighbor_tuple in unvisited:
            path_segment = path_cache.get((current_pos_tuple, neighbor_tuple))
            if path_segment and (shortest_path_segment is None or len(path_segment) < len(shortest_path_segment)):
                shortest_path_segment = path_segment
                nearest_neighbor = neighbor_tuple
        
        if not nearest_neighbor:
            # If a goal is unreachable, we can't complete the tour
            return None 

        # Add the path segment to the full path
        if full_path:
            full_path.extend(shortest_path_segment[1:])
        else:
            full_path.extend(shortest_path_segment)
            
        current_pos_tuple = nearest_neighbor
        unvisited.remove(nearest_neighbor)

    # Return to start
    return_to_start_path = path_cache.get((current_pos_tuple, tuple(start.items())))
    if return_to_start_path:
        full_path.extend(return_to_start_path[1:])

    return full_path
    