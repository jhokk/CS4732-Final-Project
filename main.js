'use strict';

var gl;
var program;

let controlPoints = [vec2(0.0, 0.0)];
let position = vec2(0.0 , 0.0);
let velocity = vec2(5.0 , 0.0);
let stars = [];
let enemies = [];

let circlePoints = [];

let dt = 0.001;
let radius = 0.03;
let mass = 3.0;
let hitBox = {
    x: 0.02,
    y: 0.03,
    w: 0.06,
    h: 0.18,
};

let wobble = false;

let theta = 0;
let gamma = 0;
let boosting = false;
let jumping = false;
let gameOver = false;

const M = mat4(
    vec4(-0.5, 1.5, -1.5, 0.5),
    vec4(1, -2.5, 2, -0.5),
    vec4(-0.5, 0, 0.5, 0),
    vec4(0, 1, 0, 0)
);

const enemyPts = [
    vec2(0.05, 0.0), 
    vec2(-0.05, 0.0), 
    vec2(0.05, 0.05), 
    vec2(-0.05, 0.05), 
    vec2(0.05, 0.1), 
    vec2(-0.05, 0.1), 
    vec2(0.05, 0.15), 
    vec2(-0.05, 0.15), 
    vec2(0.05, 0.2), 
    vec2(-0.05, 0.2)
];

const weights = [
    vec4(1.0, 0.0, 0.0, 0.0), 
    vec4(1.0, 0.0, 0.0, 0.0), 
    vec4(0.5, 0.5, 0.0, 0.0), 
    vec4(0.5, 0.5, 0.0, 0.0), 
    vec4(0.0, 1.0, 0.0, 0.0), 
    vec4(0.0, 1.0, 0.0, 0.0), 
    vec4(0.0, 0.5, 0.5, 0.0), 
    vec4(0.0, 0.5, 0.5, 0.0), 
    vec4(0.0, 0.0, 1.0, 0.0), 
    vec4(0.0, 0.0, 1.0, 0.0)
];

// Key presses have the following effects:
// [a] Do something
window.addEventListener("keydown", function(event) {
    var key = event.key;
    switch (key) {
        case 'w':
            if (!boosting) {
                velocity = add(velocity, vec2(0, 8));
                boosting = true;
            }
            break;
        case 'a':
            if (!boosting) {
                velocity = add(velocity, vec2(-8, 0));
                boosting = true;
            }
            break;
        case 's':
            if (!boosting) {
                velocity = add(velocity, vec2(0, -8));
                boosting = true;
            }
            break;
        case 'd':
            if (!boosting) {
                velocity = add(velocity, vec2(8, 0));
                boosting = true;
            }
            break;
        case ' ':
            if (!jumping) {
                velocity = add(velocity, vec2(0, 8));
                position = add(position, vec2(0, 0.05));
                jumping = true;
            }
            break;
    }
}, false);

window.addEventListener("keyup", function(event) {
    var key = event.key;
    switch (key) {
        case 'w':
            boosting = false;
            break;
        case 'a':
            boosting = false;
            break;
        case 's':
            boosting = false;
            break;
        case 'd':
            boosting = false;
            break;
        case ' ':
            jumping = false;
            break;
    }
}, false);

// Initialize WebGL and simulation
function main() {
    const canvas = document.getElementById("webgl");
    gl = WebGLUtils.setupWebGL(canvas, null);
    if (!gl) { alert("WebGL isn't available"); return; }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.9, 0.9, 0.9, 1.0);
    program = initShaders(gl, "vshader", "fshader");
    gl.useProgram(program);
    
    gl.uniform1i(gl.getUniformLocation(program, "wobble"), false);

    const vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vec2(0, 0)), gl.DYNAMIC_DRAW);

    const vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
    
    uploadData("weights", weights, 4);

    gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(mat4()));

    let cameraMatrix = lookAt( vec3(0, 0, 0), vec3(0, 0, 0), vec3(0, 1, 0) );
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "cameraMatrix"), false, flatten(cameraMatrix));

	gl.uniform4fv(gl.getUniformLocation(program, 'vColor'), flatten([0.0, 0.0, 0.0, 1.0]));

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    
    // Generate initial control points
    for (let i = -1; i < 5; i++) {
        generateStars();
        generateControlPoint();
    }

    // Generate circle points
    for (let i = 0; i < 360; i += 15) {
        circlePoints.push( vec2(0.025 * Math.cos(radians(i)), 0.025 * Math.sin(radians(i))) );
    }

    // Generate initial position
    position = generateCatmullRomPoint(2, position[0] % 1);
    position[1] += 5 * radius;

    render();
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!gameOver) {
        updatePlayer();
        detectEnemyCollision();

        if (position[0] >= controlPoints.length - 6) {
            generateControlPoint();
            generateStars();
            generateEnemies();
        }

        let cameraMatrix = lookAt( vec3(position[0], position[1], 1), vec3(position[0], position[1], 0), vec3(0, 1, 0) );
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "cameraMatrix"), false, flatten(cameraMatrix));

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(mat4()));

        let splinePoints = generateCatmullRomCurve();
        uploadData("vPosition", splinePoints);
        gl.drawArrays(gl.LINE_STRIP, 0, splinePoints.length / 2);

        drawPlayer();

        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(mat4()));
        uploadData("vPosition", stars);
        gl.drawArrays(gl.POINTS, 0, stars.length);


        let boneMatrix0 = mat4();
        let boneMatrix1 = mult(rotateZ(5 * Math.sin(gamma)), mat4());
        let boneMatrix2 = mult(rotateZ(5 * Math.sin(gamma)), boneMatrix1);
        gamma += 0.10;

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "boneMatrix0"), false, flatten(boneMatrix0));
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "boneMatrix1"), false, flatten(boneMatrix1));
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "boneMatrix2"), false, flatten(boneMatrix2));

        drawEnemies();

        requestAnimationFrame(render);
    }
}


function drawEnemies() {
    uploadData("vPosition", enemyPts);

    gl.uniform1i(gl.getUniformLocation(program, "wobble"), true);
    for (let e of enemies) {
        let enemyMat = translate(e[0], e[1], 0.0);
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(enemyMat));
         
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, enemyPts.length);
    }
    gl.uniform1i(gl.getUniformLocation(program, "wobble"), false);
}


function drawPlayer() {
    let stack = [];
    let modelMatrix = mat4();
    let transform = mat4();
    //theta += 0.1;
    theta += Math.max(length(velocity) / 150, 0.05);

    let linePoints = [vec2(0, 0), vec2(0, 0.1)];

    stack.push(modelMatrix); // Body

        transform = mult(translate(position[0], position[1]+0.04, 0), rotateZ(-7));
        modelMatrix = mult(modelMatrix, transform);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(
            mult(modelMatrix, scalem(0.7, 0.7, 1)) ));
	    uploadData("vPosition", linePoints);
	    gl.drawArrays(gl.LINE_STRIP, 0, linePoints.length);

        stack.push(modelMatrix); // Right Upper Leg

            transform = rotateZ(-150 + 50 * (Math.sin(theta)));
            modelMatrix = mult(modelMatrix, transform);

            gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(
                mult(modelMatrix, scalem(0.5,0.5,1)) ));
            uploadData("vPosition", linePoints);
            gl.drawArrays(gl.LINE_STRIP, 0, linePoints.length);

            stack.push(modelMatrix); // Right Lower leg

                transform = mult(translate(0,0.05,0), rotateZ(-80 - 30 * Math.sin(theta)));
                modelMatrix = mult(modelMatrix, transform);

                gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(
                    mult(modelMatrix, scalem(0.5,0.5,1)) ));
                uploadData("vPosition", linePoints);
                gl.drawArrays(gl.LINE_STRIP, 0, linePoints.length);

                stack.push(modelMatrix); // Right Foot

                    transform = mult(translate(0,0.05,0), rotateZ(120));
                    modelMatrix = mult(modelMatrix, transform);

                    gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(
                        mult(modelMatrix, scalem(0.5,0.2,1)) ));
                    uploadData("vPosition", linePoints);
                    gl.drawArrays(gl.LINE_STRIP, 0, linePoints.length);

                modelMatrix = stack.pop();
            modelMatrix = stack.pop();
        modelMatrix = stack.pop();


        stack.push(modelMatrix); // Left Upper Leg

            transform = rotateZ(-150 + 50 * Math.cos(theta));
            modelMatrix = mult(modelMatrix, transform);

            gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(
                mult(modelMatrix, scalem(0.5,0.5,1)) ));
            uploadData("vPosition", linePoints);
            gl.drawArrays(gl.LINE_STRIP, 0, linePoints.length);

            stack.push(modelMatrix); // Left Lower leg

                transform = mult(translate(0,0.05,0), rotateZ(-80 - 30 * Math.cos(theta)));
                modelMatrix = mult(modelMatrix, transform);

                gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(
                    mult(modelMatrix, scalem(0.5,0.5,1)) ));
                uploadData("vPosition", linePoints);
                gl.drawArrays(gl.LINE_STRIP, 0, linePoints.length);

                stack.push(modelMatrix); // Left Foot

                    transform = mult(translate(0,0.05,0), rotateZ(120));
                    modelMatrix = mult(modelMatrix, transform);

                    gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(
                        mult(modelMatrix, scalem(0.5,0.2,1)) ));
                    uploadData("vPosition", linePoints);
                    gl.drawArrays(gl.LINE_STRIP, 0, linePoints.length);

                modelMatrix = stack.pop();
            modelMatrix = stack.pop();
        modelMatrix = stack.pop();


        stack.push(modelMatrix); // Right Upper Arm

            transform = mult(translate(0, 0.055, 0), rotateZ(-170 + 55 * (Math.sin(theta))));
            modelMatrix = mult(modelMatrix, transform);

            gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(
                mult(modelMatrix, scalem(0.45, 0.45, 1)) ));
            uploadData("vPosition", linePoints);
            gl.drawArrays(gl.LINE_STRIP, 0, linePoints.length);

            stack.push(modelMatrix); // Right Lower Arm

                transform = mult(translate(0, 0.045, 0), rotateZ(110 + 10 * Math.sin(theta)));
                modelMatrix = mult(modelMatrix, transform);

                gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(
                    mult(modelMatrix, scalem(0.35, 0.35, 1)) ));
                uploadData("vPosition", linePoints);
                gl.drawArrays(gl.LINE_STRIP, 0, linePoints.length);

            modelMatrix = stack.pop();
        modelMatrix = stack.pop();


        stack.push(modelMatrix); // Left Upper Arm

            transform = mult(translate(0, 0.055, 0), rotateZ(-170 + 55 * (Math.cos(theta))));
            modelMatrix = mult(modelMatrix, transform);

            gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(
                mult(modelMatrix, scalem(0.45, 0.45, 1)) ));
            uploadData("vPosition", linePoints);
            gl.drawArrays(gl.LINE_STRIP, 0, linePoints.length);

            stack.push(modelMatrix); // Left Lower Arm

                transform = mult(translate(0, 0.045, 0), rotateZ(115 + 15 * Math.cos(theta)));
                modelMatrix = mult(modelMatrix, transform);

                gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(
                    mult(modelMatrix, scalem(0.35, 0.35, 1)) ));
                uploadData("vPosition", linePoints);
                gl.drawArrays(gl.LINE_STRIP, 0, linePoints.length);

            modelMatrix = stack.pop();
        modelMatrix = stack.pop();


        stack.push(modelMatrix);

            transform = translate(0, 0.093, 0);
            modelMatrix = mult(modelMatrix, transform);

            gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(modelMatrix));
            uploadData("vPosition", circlePoints);
            gl.drawArrays(gl.LINE_LOOP, 0, circlePoints.length);

        modelMatrix = stack.pop();


    modelMatrix = stack.pop();

    modelMatrix = mat4();
    
    let hitBoxPoints = [
        vec2(position[0] - hitBox.x, position[1] - hitBox.y),
        vec2(position[0] - hitBox.x+hitBox.w, position[1] - hitBox.y),
        vec2(position[0] - hitBox.x+hitBox.w, position[1] - hitBox.y+hitBox.h),
        vec2(position[0] - hitBox.x, position[1] - hitBox.y+hitBox.h)
    ];
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(modelMatrix));
    uploadData("vPosition", hitBoxPoints);
    gl.drawArrays(gl.LINE_LOOP, 0, hitBoxPoints.length);
}

function uploadData(name, data, size=2) {
    let buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(data), gl.STATIC_DRAW);
	let loc = gl.getAttribLocation(program, name);
	gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
}

function getSplineSlope(x) {
    let controlPointIndex = 0;
    while (controlPoints[controlPointIndex + 1][0] <= x) {
        controlPointIndex++;
    }

    let cp1 = controlPoints[controlPointIndex];
    let cp2 = controlPoints[controlPointIndex + 1];

    let T1 = (x - cp1[0]) / (cp2[0] - cp1[0]) - 0.01;
    let T2 = (x - cp1[0]) / (cp2[0] - cp1[0]) + 0.01;

    let p1;
    let p2;

    if (T1 < 0)
        p1 = generateCatmullRomPoint(controlPointIndex - 1, T1 + 1);
    else
        p1 = generateCatmullRomPoint(controlPointIndex, T1);

    if (T2 > 1)
        p2 = generateCatmullRomPoint(controlPointIndex + 1, T2 - 1);
    else
        p2 = generateCatmullRomPoint(controlPointIndex, T2);

    let slope = (p2[1] - p1[1]) / (p2[0] - p1[0]);
    return slope;
}


function generateCatmullRomCurve(segments = 20) {
	let curve = [];
	
	for (var i = 1; i < controlPoints.length-2; i++) {
		
        for ( var j = 0; j < segments; j++ ) {
			curve.push( generateCatmullRomPoint(i, j /segments) );
		}
	}
	
	return new Float32Array( flatten(curve) );
}


function generateCatmullRomPoint(i, T) {
	let Bx = vec4(controlPoints[i-1][0], controlPoints[i][0], controlPoints[i+1][0], controlPoints[i+2][0]);
	let By = vec4(controlPoints[i-1][1], controlPoints[i][1], controlPoints[i+1][1], controlPoints[i+2][1]);
	
	let U = vec4(T*T*T, T*T, T, 1);
	
	let x = dot( mult(M, Bx), U );
	let y = dot( mult(M, By), U );
	
	return vec2(x, y);
}


function getSplinePoint(x) {
    let controlPointIndex = 0;
    while (controlPoints[controlPointIndex + 1][0] <= x) {
        controlPointIndex++;
    }

    let splinePoint = generateCatmullRomPoint(controlPointIndex, x % 1);
    return splinePoint;
}


function generateControlPoint() {
    let point = vec2(controlPoints[controlPoints.length-1][0]+1, Math.random() * 2.0 - 1);
    point[1] *= 0.85;
    controlPoints.push(point);
}


function updatePlayer() {
    let fGravity = vec2(0, -9.81 * mass);
    let fBasic = vec2(2, 0);
    let fNormal = vec2(0,0);
    let acceleration = scale( mass, add(add(fGravity, fBasic), fNormal) );

    velocity = add(velocity, scale(dt, acceleration));

    let p = detectSplineCollision();
    if (p) {
        let slope = getSplineSlope(p[0]);
        let normal = normalize(vec2(-1 * slope, 1));
        let component = scale( dot(velocity, normal), normal );
        velocity = scale( 1, subtract(velocity, scale(1, component)) );
    }

    lockPlayerOnSpline();
    
    position = add(position, scale(dt, velocity));
}

function detectSplineCollision() {
    let checkPoints = [];

    for (let offset = -1 * radius; offset <= radius; offset += radius / 8) {

        let splinePoint = getSplinePoint(position[0] + offset);
        checkPoints.push(splinePoint);
    }

    for (let p of checkPoints) {
        let dist = length(subtract(p, position));
        if (dist <= radius) {
            return p;
        }
    }
}

function detectEnemyCollision() {
    let nearbyEnemies = [];
    for (let e of enemies) {
        if (Math.abs(e[0] - position[0]) < 0.2) {
            nearbyEnemies.push(e);
        }
    }

    let player = {
        x: position[0] - hitBox.x,
        y: position[1] - hitBox.y,
        w: hitBox.w,
        h: hitBox.h,
    };

    for (let e of nearbyEnemies) {
        let enemy = {
            x: e[0] - 0.05,
            y: e[1] - 0.05,
            w: 0.1,
            h: 0.2,
        };
        
        if (
            player.x < enemy.x + enemy.w &&
            player.x + player.w > enemy.x &&
            player.y < enemy.y + enemy.h &&
            player.y + player.h > enemy.y
        ) {
            gameOver = true;
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
        }
    }
}

function lockPlayerOnSpline() {
    let splinePoint = getSplinePoint(position[0]);
    if (position[1] - radius <= splinePoint[1]) {
        position[1] = splinePoint[1] + radius;
        return true;
    } else {
        return false;
    }
}

function generateStars() {
    for (let i = 0; i < 5; i++) {
        let star = vec2(controlPoints[controlPoints.length-1][0] + Math.random(), Math.random());
        stars.push(star);
    }
}

function generateEnemies() {
    for (let i = 0; i < 20; i++) {
        if (Math.floor(Math.random() * 30) === 0) {
            let enemyPosition = getSplinePoint(controlPoints[controlPoints.length-3][0] + i/20);
            enemies.push(vec2(enemyPosition[0], enemyPosition[1]));
        }
    }
}