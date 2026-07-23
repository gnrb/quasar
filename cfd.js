// ==========================================
// cfd.js - DINÁMICA DE FLUIDOS GPGPU (POLVO)
// ==========================================

let gpuCompute;
let positionVariable, velocityVariable;
const TEX_WIDTH = 64; // Matriz 64x64 = 4096 partículas de polvo interactivo

function initCFD(renderer) {
    // ¡AQUÍ ESTABA EL ERROR! Faltaba el namespace THREE.
    gpuCompute = new THREE.GPUComputationRenderer(TEX_WIDTH, TEX_WIDTH, renderer);

    const dtPosition = gpuCompute.createTexture();
    const dtVelocity = gpuCompute.createTexture();

    // Estado inicial del fluido
    const posArray = dtPosition.image.data;
    const velArray = dtVelocity.image.data;
    for (let i = 0; i < posArray.length; i += 4) {
        posArray[i]     = (Math.random() - 0.5) * 15; 
        posArray[i + 1] = (Math.random() - 0.5) * 3;  
        posArray[i + 2] = (Math.random() - 0.5) * 15; 
        posArray[i + 3] = 1.0;

        velArray[i] = 0; velArray[i + 1] = 0; velArray[i + 2] = 0; velArray[i + 3] = 1;
    }

    const velShader = `
        uniform float uTime;
        void main() {
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            vec4 pos = texture2D(texturePosition, uv);
            vec4 vel = texture2D(textureVelocity, uv);
            
            // 1. Turbulencia de fondo (Restos de energía térmica del gas)
            vec3 p = pos.xyz * 0.4 + uTime * 0.15;
            vec3 thermalTurbulence = vec3(
                cos(p.y) - sin(p.z),
                cos(p.z) - sin(p.x),
                cos(p.x) - sin(p.y)
            );
            
            // 2. Mecánica Orbital (Atracción al Agujero Negro Supermasivo)
            vec3 dir = -normalize(pos.xyz);
            float r = length(pos.xyz);
            
            // Gravedad Fuerte G*M/r^2 (Masa central dominante)
            vec3 gravity = dir * (3.5 / (r * r + 0.1)); 
            
            // Vector tangencial para forzar órbita en el plano XZ
            vec3 orbitDir = normalize(cross(vec3(0.0, 1.0, 0.0), pos.xyz));
            vec3 orbitalVelocity = orbitDir * sqrt(3.5 / (r + 0.1));
            
            // 3. Integración de Fuerzas
            vel.xyz += (thermalTurbulence * 0.015 + gravity * 0.05);
            
            // Mezclamos la física de fluidos con la velocidad kepleriana
            vel.xyz = mix(vel.xyz, orbitalVelocity, 0.12);
            
            // Fricción más baja (Vacío espacial)
            vel.xyz *= 0.985; 
            
            gl_FragColor = vel;
        }
    `;

    const posShader = `
        void main() {
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            vec4 pos = texture2D(texturePosition, uv);
            vec4 vel = texture2D(textureVelocity, uv);
            
            pos.xyz += vel.xyz * 0.016; 
            
            if(length(pos.xyz) > 12.0) {
                pos.xyz = pos.xyz * 0.1; 
            }
            
            gl_FragColor = pos;
        }
    `;

    velocityVariable = gpuCompute.addVariable("textureVelocity", velShader, dtVelocity);
    positionVariable = gpuCompute.addVariable("texturePosition", posShader, dtPosition);

    gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);
    gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);

    velocityVariable.material.uniforms.uTime = { value: 0.0 };

    const error = gpuCompute.init();
    if (error !== null) console.error("Error GPGPU:", error);
}