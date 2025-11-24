import uvicorn
import time
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional

# Make sure rl_logic.py is in the same folder as app.py
try:
    from rl_logic import find_path, find_path_scan, find_path_multi_goal, find_path_tsp_nearest_neighbor, train_model, get_trained_action
except ImportError:
    print("CRITICAL ERROR: rl_logic.py not found. Make sure it is uploaded.")
    raise

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

class TrainRequest(BaseModel):
    size: int
    infection_chance: float
    wind_speed: float
    episodes: int

class GetActionRequest(BaseModel):
    state: List[float]

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

# --- API Endpoints ---
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

@app.post("/train-model")
async def train_model_endpoint(request: TrainRequest):
    try:
        rewards = train_model(
            size=request.size,
            infection_chance=request.infection_chance,
            wind_speed=request.wind_speed,
            episodes=request.episodes
        )
        return {"status": "success", "rewards": rewards}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get-action")
async def get_action_endpoint(request: GetActionRequest):
    try:
        action = get_trained_action(request.state)
        return {"status": "success", "action": action}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Mount Frontend (Safe Mode) ---
# This logic prevents the app from crashing if the folder is missing
current_dir = os.path.dirname(os.path.abspath(__file__))
frontend_path = os.path.join(current_dir, "..", "frontend")

if os.path.exists(frontend_path) and os.path.isdir(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")
    print(f"Frontend mounted successfully from {frontend_path}")
else:
    print(f"WARNING: Frontend directory not found at {frontend_path}. API is running, but UI will fail.")
    @app.get("/")
    def index():
        return {"message": "Backend is running. Frontend folder not found. Check your directory structure."}

# --- Startup Configuration ---
if __name__ == "__main__":
    # Use the PORT environment variable provided by Render
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
