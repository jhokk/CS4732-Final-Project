# CS4732 Final Project
Joel Hokkanen (jehokkanen@wpi.edu), Kruti Shah (kcshah2@wpi.edu)

1. Description: 2D Runner Game. This is a game where the player runs and jumps along an infinite track. The track will randomly generate obstacles/enemies that the player has to avoid. If the player gets hit, it is game over. 

2. Topics represented:
    - Splines: The splines are drawn using the Catmull-Rom algorithm. Control points are randomly generated, which will draw the spline. This is the "track" that the player runs along.
    - Quaternions and SLERPing: N/A
    - Shape Deformation: The enemies deform by bending as the game is playing.
    - Skeletal animation: The enemies have bones and wiggle using their points, bones, and weights. They are also randomly generated along the spline.
    - Hierarchical modeling/kinematics: Our player character is hierarchically modeled. They are a stick figure with arm and leg joints. We use a stack to draw the character.
    - Physically-based animation: Our player character uses physically-based animation. When the jump button is pressed, the character will jump and fall in an arc. The character moves using forces, and falls due to gravity after jumping. 

3. Any additional instructions that might be needed to fully use your project (interaction controls, etc.): 
    - Jump: Space
    - Dash: D
    - Backward Dash: A

4. What challenges you faced in completing the project: Hierarchical modeling was a bit of a struggle to get back into at first. We thought we had it down from Project 2 but since the shapes were different (this project is 2D and does not use cubes), we struggled a bit remembering how it worked. We also had issues with our buffer/index sizing when doing the skeletal animation. For the physics-based animation, we needed to experiment with a lot of different forces, as well as how our jump/running physics were going to function (ex: does the height of the "hill"/track determine the speed of the player character?)

5. What each group member was responsible for designing / developing:
    - Kruti: Initial hierarchical modeling/humanoid creation, skeletal animation and enemy/obstacle spawning, README.
    - Jay: Spline generation, physically-based animation such as our jump and dash mechanic, the rest of the hierarchical modeling. 