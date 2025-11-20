# RL Farm Simulator

An interactive web application that visualizes reinforcement learning and pathfinding algorithms in a fun, farm-simulation environment. Users can design a farm, assign tasks, and watch a drone execute them using various intelligent algorithms.

![RL Farm Simulator Screenshot](frontend/images/final.png) 
*(Note: This is a placeholder image from your project. You can replace it with a better screenshot of the running application.)*

---

## ✨ Features

*   **Interactive Farm Creation:** Dynamically create a farm grid of any size.
*   **Drag & Drop Interface:** Easily place tools, the drone, and obstacles onto the farm.
*   **Multiple Pathfinding Algorithms:** Choose between different algorithms to see how they perform:
    *   **A\* Multi-Goal:** A greedy approach to visit multiple targets.
    *   **TSP Nearest Neighbor:** A heuristic to solve the Traveling Salesperson Problem.
    *   **Full Scan:** A serpentine path to explore the entire grid.
*   **Task-Based Simulation:** Command the drone to perform tasks like exploring, planting seeds, and pest control.
*   **Game-like Progression:** Advance through days, manage a to-do list, and grow crops from germination to harvest.
*   **Client-Server Architecture:** A lightweight frontend for visualization and a powerful Python backend for complex pathfinding calculations.

---

## 🛠️ Tech Stack

*   **Frontend:**
    *   HTML5
    *   CSS3 (with custom properties for theming and a retro aesthetic)
    *   Vanilla JavaScript (ES6+)
*   **Backend:**
    *   Python 3
    *   FastAPI (for the high-performance API)
    *   Uvicorn (as the ASGI server)

---

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   Python 3.8+ and `pip` installed on your machine.
*   A modern web browser.

### Installation & Setup

1.  **Clone the repository (or use your local copy):**
    ```sh
    git clone https://github.com/your-username/your-repository-name.git
    cd your-repository-name
    ```

2.  **Set up the Backend:**
    *   Navigate to the backend directory and install the required Python packages.
      ```sh
      cd backend
      pip install -r requirements.txt
      ```
    *   Start the backend server.
      ```sh
      uvicorn app:app --reload
      ```
    *   The server will be running at `http://127.0.0.1:8000`.

3.  **Launch the Frontend:**
    *   In your file explorer, navigate to the `frontend` directory.
    *   Open the `index.html` file in your web browser.

The application should now be running and fully functional on your local machine.

---

## 🎮 How to Use

1.  **Create a Farm:** Use the controls on the right panel to set a width and height, then click **"Create Farm"**.
2.  **Explore the Land:** The initial farm is covered in "cards." To see what's underneath, set the task to **"Explore"** and click **"Start Simulation"**.
3.  **Prepare the Land:** Drag the **pickaxe** from the left panel onto grass or barren land to prepare it for planting.
4.  **Place the Drone:** Drag the **drone** from the warehouse and place it on any open tile. This will be its starting position.
5.  **Run a Task:**
    *   Select a task from the dropdowns (e.g., "Select All" and "Plant Seeds").
    *   Choose an **algorithm**.
    *   Click **"Start Simulation"**.
6.  **Advance Time:** Once all tasks for a day are complete, click **"Next Day"** to advance the simulation and see your crops grow.

---

## ☁️ Deployment on Render

This project is configured for easy deployment on [Render](https://render.com).

1.  **Create a GitHub Repository:** Push your project code to a new repository on GitHub.
2.  **Create a Render Account:** Sign up for a free account on Render.
3.  **Create a New Web Service:**
    *   On your Render dashboard, click "**New**" -> "**Web Service**".
    *   Connect your GitHub account and select your repository.
    *   Render will automatically detect the `render.yaml` file and configure two services: one for the backend (`rl-simulation-backend`) and one for the frontend (`rl-simulation-frontend`).
4.  **Deploy:**
    *   Click "**Create Web Service**". Render will build and deploy both services.
5.  **Update API URL:**
    *   After deployment, Render will give you a public URL for your backend (e.g., `https://rl-simulation-backend.onrender.com`).
    *   You must update the `API_URL` constant in `frontend/script.js` to this new URL and push the change to your repository for the frontend to be able to communicate with the backend.
      ```javascript
      // in frontend/script.js
      const API_URL = 'https://rl-simulation-backend.onrender.com/run-simulation'; 
      ```
