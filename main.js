'use strict';

var gl;
var program;

let controlPoints = [];
let position = vec2(0.0 , 0.0);
let velocity = vec2(0.0 , 0.0);
let playerPoints = [];

let dt = 0.001;
let radius = 0.025;
let mass = 1.0;
let yOffset = 0;

const Speed = {
    FAST: 1 / 64,
    MEDIUM: 1 / 128,
    SLOW: 1 / 256,
    VSLOW: 1 / 512
};

const M = mat4(
    vec4(-0.5, 1.5, -1.5, 0.5),
    vec4(1, -2.5, 2, -0.5),
    vec4(-0.5, 0, 0.5, 0),
    vec4(0, 1, 0, 0)
);

// Key presses have the following effects:
// [a] Do something
window.addEventListener("keypress", function(event) {
    var key = event.key;
    switch (key) {
        case ' ':
            yOffset += 0.5;
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

    const vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vec2(0, 0)), gl.DYNAMIC_DRAW);

    const vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
    
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(mat4()));

    let cameraMatrix = lookAt( vec3(0, 0, 0), vec3(0, 0, 0), vec3(0, 1, 0) );
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "cameraMatrix"), false, flatten(cameraMatrix));

	gl.uniform4fv(gl.getUniformLocation(program, 'vColor'), flatten([0.0, 0.0, 0.0, 1.0]));

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    
    // Generate initial control points
    for (let i = -2; i < 5; i++) {
        generateControlPoint(i, true);
    }

    // Generate circle points
    for (let i = 0; i < 360; i += 15) {
        playerPoints.push( vec2(radius * Math.cos(radians(i)), radius * Math.sin(radians(i))) );
    }

    // Generate initial position
    position = generateCatmullRomPoint(2, position[0] % 1);
    position[1] += 5 * radius;

    render();
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    //position = generateCatmullRomPoint(2, position[0] % 1);
    updatePlayer();

    //position[0] += Speed.SLOW;
    if (position[0] >= controlPoints[controlPoints.length - 4][0]) {
        generateControlPoint(position[0] + controlPoints.length - 3);
    }

    let cameraMatrix = lookAt( vec3(position[0], 0, 1), vec3(position[0], 0, 0), vec3(0, 1, 0) );
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "cameraMatrix"), false, flatten(cameraMatrix));

    gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(mat4()));

	let splinePoints = generateCatmullRomCurve();
    
	// Buffer
	let positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, splinePoints, gl.STATIC_DRAW);

	// Attribute
	let positionLoc = gl.getAttribLocation(program, "vPosition");
	gl.enableVertexAttribArray(positionLoc);
	gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

	gl.drawArrays(gl.LINE_STRIP, 0, splinePoints.length / 2);


    

    drawPlayer();

    requestAnimationFrame(render);
}


function drawPlayer() {

    gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(translate(position[0], position[1]+yOffset, 0)));

	let positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(playerPoints), gl.STATIC_DRAW);
	let positionLoc = gl.getAttribLocation(program, "vPosition");
    gl.enableVertexAttribArray(positionLoc);
	gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

	gl.drawArrays(gl.LINE_LOOP, 0, playerPoints.length);
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
    //console.log(slope);
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


function generateControlPoint(x, init=false) {
    if (!init) {
        controlPoints.shift();
    }

    let point = vec2(x, Math.random() * 2.0 - 1);
    point[1] *= 0.85;
    controlPoints.push(point);
}


function updatePlayer() {
    position = add(position, scale(dt, velocity));

    let fGravity = vec2(0, -9.81 * mass);
    let fBasic = vec2(0,0);
    let fNormal = vec2(0,0);
    if (playerOnSpline()) {
        let theta = Math.atan(getSplineSlope(position[0]));
        //console.log(theta);
        fNormal = scale( length(fGravity), vec2(Math.cos(theta), Math.sin(theta)) );
        console.log(fNormal);
    }
    let acceleration = scale( mass, add(add(fGravity, fBasic), fNormal) );

    velocity = add(velocity, scale(dt, acceleration));

    //console.log(playerOnSpline());

    
}


function playerOnSpline() {
    let splinePoint = generateCatmullRomPoint(2, position[0] % 1);
    if (position[1] - radius <= splinePoint[1]) {
        return true;
    } else {
        return false;
    }
}