'use strict';

var gl, program, canvas;

let controlPoints = [];
let position = vec2(0.0 , 0.0);
let velocity = vec2(0.0 , 0.0);
let circlePoints = [];

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

let M = mat4(
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
    canvas = document.getElementById("webgl");
    gl = WebGLUtils.setupWebGL(canvas, null);
    if (!gl) { alert("WebGL isn't available"); return; }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.9, 0.9, 0.9, 1.0);
    program = initShaders(gl, "vshader", "fshader");
    gl.useProgram(program);

    const vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vec2(0, 0)), gl.DYNAMIC_DRAW);

    setBufferPos("vPosition");
    
    updateMatrix("modelMatrix", mat4());

    let cameraMatrix = lookAt( vec3(0, 0, 0), vec3(0, 0, 0), vec3(0, 1, 0) );
    updateMatrix("cameraMatrix", cameraMatrix);

    // set initial color
	gl.uniform4fv(gl.getUniformLocation(program, 'vColor'), flatten([0.0, 0.0, 0.0, 1.0]));

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Generate initial control points
    for (let i = -2; i < 5; i++) {
        generateControlPoint(i, true);
    }

    // Generate circle points
    for (let i = 0; i < 360; i += 15) {
        circlePoints.push( vec2(radius * Math.cos(radians(i)), radius * Math.sin(radians(i))) );
    }

    // Generate initial position
    position = generateCatmullRomPoint(2, position[0] % 1);
    position[1] += 5 * radius;

    render();
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    position[0] += Speed.SLOW;
    if (position[0] >= controlPoints[controlPoints.length - 4][0]) {
        generateControlPoint(position[0] + controlPoints.length - 3);
    }

    let cameraMatrix = lookAt( vec3(position[0], 0, 1), vec3(position[0], 0, 0), vec3(0, 1, 0) );

    updateMatrix("cameraMatrix", cameraMatrix);
    updateMatrix("modelMatrix", mat4());

	let splinePoints = generateCatmullRomCurve();
    
	// Buffer
    uploadData(splinePoints);
	// Attribute
    setBufferPos("vPosition");
	
	gl.drawArrays(gl.LINE_STRIP, 0, splinePoints.length / 2);

    position = generateCatmullRomPoint(2, position[0] % 1);

    updatePlayer();
    drawPlayer();

    requestAnimationFrame(render);
}

let stack = [];
//let pointsArray = [];
let colorsArray = [];
let bodyPts = [];
let model = mat4();
let transform;

let theta = 0.01;
let runSpeed = 40;

function drawPlayer() {
    model = translate(position[0], position[1]+0.15, 0.0);
    updateMatrix("modelMatrix", model);

    // draw main BODY
    bodyPts.push(vec2(0.0, 0.0));
    bodyPts.push(vec2(0.0, 0.2));

    setBuffer(bodyPts, "vPosition");
    //gl.drawArrays(gl.LINE_LOOP, 0, bodyPts.length);

    stack.push(model);
        // HEAD
        updateMatrix("modelMatrix", mult(model, (translate(0.0, 0.23, 0.0))));
        
        setBuffer(circlePoints, "vPosition");
	    gl.drawArrays(gl.LINE_LOOP, 0, circlePoints.length);
    
        // LEGS
        // right leg
        setBuffer(bodyPts, "vPosition");
        transform = mult(translate(0.0, 0.0, 0.0), rotateZ(Math.sin(5*theta)*runSpeed));
        model = mult(model, transform);
        
        updateMatrix("modelMatrix", mult(model, mult(scalem(0.5, 0.5, 1.0), rotateZ(-140))));
        gl.drawArrays(gl.LINE_LOOP, 0, bodyPts.length);

        stack.push(model);
            transform = mult(translate(0.0, -0.0, 0.0), mult(scalem(1.0, 1.0, 1.0), rotateZ(0)));
            model = mult(model, transform);
            
            updateMatrix("modelMatrix", model);
            gl.drawArrays(gl.LINE_LOOP, 0, bodyPts.length);

}
function drawModel(modelMat) {
    gl.uniformMatrix4fv(modelMatrixLoc, false, flatten(modelMat));
    gl.drawArrays(gl.LINE_LOOP, 0, pointsArray.length);
}


function updatePlayer() {
    //position = add(position, scale(dt, velocity));

    //let forces = vec2(0, -9.81 * mass);
    //velocity = add(velocity, scale(dt / mass, forces));

    if (yOffset > 0) {
        yOffset = Math.max(0, yOffset-0.005);
    }
}



// v GENERATION FUNCTIONS: v
function generateCatmullRomPoint(i, T) {
	let Bx = vec4(controlPoints[i-1][0], controlPoints[i][0], controlPoints[i+1][0], controlPoints[i+2][0]);
	let By = vec4(controlPoints[i-1][1], controlPoints[i][1], controlPoints[i+1][1], controlPoints[i+2][1]);
	
	let U = vec4(T*T*T, T*T, T, 1);
	
	let x = dot( mult(M, Bx), U );
	let y = dot( mult(M, By), U );
	
	return vec2(x, y);
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
function generateControlPoint(x, init=false) {
    if (!init) {
        controlPoints.shift();
    }

    let point = vec2(x, Math.random() * 2.0 - 1);
    point[1] *= 0.85;
    controlPoints.push(point);
}

function updateMatrix(matrixName, matrixValue) {  
    let matrixLoc = gl.getUniformLocation(program, matrixName);
    gl.uniformMatrix4fv(matrixLoc, false, flatten(matrixValue));
}
// v BUFFER FUNCTIONS: v
function setBuffer(array, buffName) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // uploading buffer data
    gl.bufferData(gl.ARRAY_BUFFER, flatten(array), gl.STATIC_DRAW);

    var position = gl.getAttribLocation(program, buffName);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(position); // enable
}
function uploadData(array) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // uploading buffer data
    gl.bufferData(gl.ARRAY_BUFFER, flatten(array), gl.STATIC_DRAW);
}
function setBufferPos(buffName) {
    var position = gl.getAttribLocation(program, buffName);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(position); // enable
}