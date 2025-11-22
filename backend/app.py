import uvicorn
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from rl_logic import find_path, find_path_scan, find_path_multi_goal, find_path_tsp_nearest_neighbor

# --- Data Models ---
class Position(BaseModel):
    x: int
    y: int

class BlockData(BaseModel):
    type: str

class SimulationRequest(BaseModel):
    grid: List[List[BlockData]]
    start: Position
    goal: Optional[Position] = None
    goals: Optional[List[Position]] = None
    algorithm: str

class PathResponse(BaseModel):
    status: str = "success"
    path: List[Position]
    calculation_time_ms: float

# --- FastAPI App Initialization ---
app = FastAPI()

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Endpoint ---
@app.post("/run-simulation", response_model=PathResponse)
async def run_simulation(request: SimulationRequest):
    try:
        grid_data = [[block.dict() for block in row] for row in request.grid]
        start_pos = request.start.dict()
        
        path = None
        start_time = time.time()

        if request.algorithm == 'scan':
            path = find_path_scan(grid_data, start_pos)
        
        elif request.algorithm == 'astar_multi':
            if not request.goals:
                raise HTTPException(status_code=400, detail="Multi-goal algorithm requires a list of goals.")
            goal_positions = [g.dict() for g in request.goals]
            path = find_path_multi_goal(grid_data, start_pos, goal_positions)

        elif request.algorithm == 'tsp_nearest_neighbor':
            if not request.goals:
                raise HTTPException(status_code=400, detail="TSP algorithm requires a list of goals.")
            goal_positions = [g.dict() for g in request.goals]
            path = find_path_tsp_nearest_neighbor(grid_data, start_pos, goal_positions)

        elif request.algorithm == 'astar':
            if not request.goal:
                raise HTTPException(status_code=400, detail="A* algorithm requires a single goal.")
            goal_pos = request.goal.dict()
            path_to_goal = find_path(grid_data, start_pos, goal_pos)
            if path_to_goal:
                # For single A*, we often want a return trip
                path_to_start = find_path(grid_data, goal_pos, start_pos)
                if path_to_start:
                    path = path_to_goal + path_to_start[1:]
        
        else:
            raise HTTPException(status_code=400, detail=f"Algorithm '{request.algorithm}' not supported.")

        end_time = time.time()
        calculation_time = (end_time - start_time) * 1000

        if path:
            return PathResponse(path=path, calculation_time_ms=calculation_time)
        else:
            raise HTTPException(status_code=404, detail="No path could be found.")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
