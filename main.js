'use strict';

var gl;
var program;

let controlPoints = [];
let position = [0.0 , 0.0];
let playerPoints = [];

//let dt = 0.005;
let radius = 0.025;

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
        case 'a':
            // do something
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

    
    for (let i = -2; i < 5; i++) {
        generateControlPoint(i, true);
    }

    for (let i = 0; i < 360; i += 15) {
        playerPoints.push( vec2(radius * Math.cos(radians(i)), radius * Math.sin(radians(i))) );
    }

    render();
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);

    position[0] += Speed.SLOW;
    if (position[0] % 1 === 0) {
        generateControlPoint(position[0] + controlPoints.length - 3);
    }

    let cameraMatrix = lookAt( vec3(position[0], position[1], 1), vec3(position[0], position[1], 0), vec3(0, 1, 0) );
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


    let pos = generateCatmullRomPoint(2, position[0] % 1);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelMatrix"), false, flatten(translate(pos[0], pos[1]+radius, 0)));

	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(playerPoints), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLoc);
	gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

	gl.drawArrays(gl.LINE_LOOP, 0, playerPoints.length);

    requestAnimationFrame(render);
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