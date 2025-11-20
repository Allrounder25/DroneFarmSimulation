# RL Simulation

This project is a simulation of a reinforcement learning agent that can find paths in a grid.

## Deployment on Render

To deploy this project on Render, follow these steps:

1.  **Create a GitHub Repository:**
    *   Create a new repository on GitHub.
    *   Initialize a git repository in your local project directory (`d:\HTML\RLSIMULATION\SIMULATION`).
    *   Add the remote origin to your local repository.
    *   Commit and push your code to the GitHub repository.

2.  **Create a Render Account:**
    *   Sign up for a free account on [render.com](https://render.com).

3.  **Create a New Web Service on Render:**
    *   Go to your Render dashboard.
    *   Click on "**New**" and then "**Web Service**".
    *   Connect your GitHub account to Render.
    *   Select your repository.
    *   Render will automatically detect the `render.yaml` file and configure the services.

4.  **Deploy:**
    *   Click on "**Create Web Service**".
    *   Render will start the deployment process. You can monitor the logs in the Render dashboard.

Once the deployment is complete, you will have two services running on Render:

*   **`rl-simulation-backend`**: Your FastAPI backend.
*   **`rl-simulation-frontend`**: Your static frontend.

You will be provided with URLs for both services. You will need to update the `fetch` URL in your `frontend/script.js` to point to the URL of your deployed backend service.
