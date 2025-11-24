import heapq
import math
import torch
import torch.nn as nn
import torch.optim as optim
import random
import numpy as np
from collections import deque

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

class DroneEnv:
    def __init__(self, size=5, infection_chance=0.1, wind_speed=0.1):
        self.size = size
        self.infection_chance = infection_chance
        self.wind_speed = wind_speed
        self.reset()

    def reset(self):
        # Field of young plants (value 2)
        self.field = np.full((self.size, self.size), 2)
        
        # Add infections
        for x in range(self.size):
            for y in range(self.size):
                if random.random() < self.infection_chance:
                    # Assign severity: 3 (normal), 4 (medium), 5 (high)
                    self.field[x, y] = random.choice([3, 4, 5])

        self.drone_pos = [0, 0]
        self.steps = 0
        self.spray_timer = 0
        return self.get_state()

    def get_state(self):
        return np.concatenate((self.field.flatten(), self.drone_pos))

    def step(self, action):
        x, y = self.drone_pos
        reward = -1 

        # If currently spraying, decrement timer and stay put
        if self.spray_timer > 0:
            self.spray_timer -= 1
            if self.spray_timer == 0:
                reward = 20 # Big reward for finishing spraying
                self.field[x,y] = 2 # Back to young plant
            else:
                reward = 5 # Small reward for continuing to spray
            return self.get_state(), reward, False

        # Wind effect
        if random.random() < self.wind_speed:
            action = random.choice([0,1,2,3]) # wind blows in a random direction

        # Movement logic
        if action == 0 and x > 0:
            x -= 1
        elif action == 1 and x < self.size - 1:
            x += 1
        elif action == 2 and y > 0:
            y -= 1
        elif action == 3 and y < self.size - 1:
            y += 1
        elif action == 4: # Start spraying
            severity = self.field[x, y]
            if severity >= 3: # If infected
                reward = 10
                self.spray_timer = severity # Set spray timer based on severity
            else:
                reward = -5
        
        self.drone_pos = [x, y]
        self.steps += 1
        done = self.steps > (self.size * self.size * 2) # Allow more steps for spraying
        return self.get_state(), reward, done

    def render(self):
        grid = np.copy(self.field)
        x, y = self.drone_pos
        grid[x, y] = 9
        print(grid)

class DQN(nn.Module):
    def __init__(self, input_dim, output_dim):
        super(DQN, self).__init__()
        self.fc = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, output_dim)
        )
    
    def forward(self, x):
        return self.fc(x)

class RLAgent:
    def __init__(self, state_size, action_size, lr=0.001, gamma=0.95,
                 epsilon=1.0, epsilon_decay=0.995, epsilon_min=0.01):
        self.state_size = state_size
        self.action_size = action_size
        self.memory = deque(maxlen=2000)
        self.gamma = gamma
        self.epsilon = epsilon
        self.epsilon_decay = epsilon_decay
        self.epsilon_min = epsilon_min
        self.lr = lr
        self.model = DQN(state_size, action_size)
        self.optimizer = optim.Adam(self.model.parameters(), lr=self.lr)
        self.criterion = nn.MSELoss()

    def act(self, state):
        if np.random.rand() <= self.epsilon:
            return random.randrange(self.action_size)
        state_tensor = torch.FloatTensor(state).unsqueeze(0)
        q_values = self.model(state_tensor)
        return torch.argmax(q_values).item()

    def remember(self, state, action, reward, next_state, done):
        self.memory.append((state, action, reward, next_state, done))

    def replay(self, batch_size=32):
        if len(self.memory) < batch_size:
            return

        batch = random.sample(self.memory, batch_size)
        for state, action, reward, next_state, done in batch:
            target = reward
            if not done:
                next_q_values = self.model(torch.FloatTensor(next_state).unsqueeze(0))
                target += self.gamma * torch.max(next_q_values).item()

            current_q_values = self.model(torch.FloatTensor(state).unsqueeze(0))
            target_f = current_q_values.clone().detach()
            target_f[0][action] = target

            loss = self.criterion(current_q_values, target_f)
            self.optimizer.zero_grad()
            loss.backward()
            self.optimizer.step()

        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

def train_model(size=5, infection_chance=0.1, wind_speed=0.1, episodes=100):
    env = DroneEnv(size=size, infection_chance=infection_chance, wind_speed=wind_speed)
    state_size = env.size * env.size + 2
    action_size = 5 # Up, Down, Left, Right, Spray
    agent = RLAgent(state_size, action_size)
    
    rewards = []

    for e in range(episodes):
        state = env.reset()
        total_reward = 0
        done = False
        while not done:
            action = agent.act(state)
            next_state, reward, done = env.step(action)
            agent.remember(state, action, reward, next_state, done)
            state = next_state
            total_reward += reward
        
        agent.replay(32)
        rewards.append(total_reward)
        print(f"Episode {e+1}/{episodes}, Total Reward: {total_reward}")

    torch.save(agent.model.state_dict(), 'drone_model.pth')
    return rewards

def get_trained_action(state):
    state_size = len(state)
    action_size = 5
    agent = RLAgent(state_size, action_size)
    agent.model.load_state_dict(torch.load('drone_model.pth'))
    agent.epsilon = 0 # No exploration, just exploitation
    return agent.act(state)