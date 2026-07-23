// ==========================================
// MOTOR BASE DE GALAXIA - FÍSICA Y RENDER
// ==========================================

let galaxyScene, galaxyCamera, galaxyRenderer, galaxyControls, galaxyComposer;
let nearDustParticles, galaxyStreakField, galaxyCoreFlareGroup, galaxyJets;
let galaxyVignetteGrainPass, blackHolePass;
const clock = new THREE.Clock();

// ==========================================
// 1. GENERADORES DE TEXTURAS PROCEDURALES
// ==========================================

function createCircleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const context = canvas.getContext('2d');
    context.beginPath(); context.arc(16, 16, 15, 0, Math.PI * 2);
    context.fillStyle = '#ffffff'; context.fill();
    return new THREE.CanvasTexture(canvas);
}

function createAuraTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0.00, 'rgba(255, 248, 220, 0.92)');
    gradient.addColorStop(0.12, 'rgba(255, 235, 180, 0.60)');
    gradient.addColorStop(0.30, 'rgba(255, 210, 130, 0.24)');
    gradient.addColorStop(0.55, 'rgba(255, 180,  90, 0.09)');
    gradient.addColorStop(0.78, 'rgba(200, 145, 255, 0.03)');
    gradient.addColorStop(1.00, 'rgba(0,0,0,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

function createNebulaTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

function createGalaxyStreakTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 384; canvas.height = 96;
    const ctx = canvas.getContext('2d');

    const g = ctx.createLinearGradient(0, 48, 384, 48);
    g.addColorStop(0.00, 'rgba(255,255,255,0)');
    g.addColorStop(0.18, 'rgba(120,210,255,0.035)');
    g.addColorStop(0.42, 'rgba(190,230,255,0.20)');
    g.addColorStop(0.52, 'rgba(255,245,210,0.16)');
    g.addColorStop(0.66, 'rgba(150,190,255,0.10)');
    g.addColorStop(1.00, 'rgba(255,255,255,0)');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const center = ctx.createRadialGradient(192, 48, 0, 192, 48, 54);
    center.addColorStop(0.00, 'rgba(255,255,255,0.22)');
    center.addColorStop(0.30, 'rgba(120,220,255,0.08)');
    center.addColorStop(1.00, 'rgba(255,255,255,0)');

    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = center;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

const starTexture = createCircleTexture();
const auraTexture = createAuraTexture();
const nebulaTexture = createNebulaTexture();
const streakTexture = createGalaxyStreakTexture();

// ==========================================
// 2. CONSTRUCCIÓN DE LA GALAXIA (SHADERS)
// ==========================================

function createUnifiedGalaxy(parameters) {
    const group = new THREE.Group();

    const starCount = 150000;
    const dustCount = 35000;

    const colorCore  = new THREE.Color('#ffffff');
    const colorInner = new THREE.Color('#ff5500');
    const colorOut   = new THREE.Color('#1a50ff');

    function smoothColorEase(t) { return t * t * (3.0 - 2.0 * t); }

    function buildLayer(count, particleSize, texture, opacity, isDust) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const randomness = new Float32Array(count * 3);
        const phases = new Float32Array(count);

        for(let i = 0; i < count; i++) {
            const i3 = i * 3;
            phases[i] = Math.random() * Math.PI * 2;

            const radius = Math.random() * parameters.radius;
            const spinAngle = radius * parameters.spin;
            const branchAngle = ((i % parameters.branches) / parameters.branches) * Math.PI * 2;
            const angle = branchAngle + spinAngle;

            const px = Math.cos(angle) * radius;
            const pz = Math.sin(angle) * radius;
            
            const flatten = isDust ? 0.25 : 0.1;
            const coreRadius = 1.3; 
            let sphericalHeight = radius < coreRadius ? Math.sqrt(coreRadius * coreRadius - radius * radius) : 0;
            const finalHeight = Math.max(sphericalHeight, flatten);
            const py = (Math.random() - 0.5) * finalHeight;

            positions[i3    ] = px;
            positions[i3 + 1] = py;
            positions[i3 + 2] = pz;

            const randomX = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;
            const randomY = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;
            const randomZ = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * parameters.randomness * radius;

            randomness[i3    ] = randomX;
            randomness[i3 + 1] = randomY * flatten;
            randomness[i3 + 2] = randomZ;

            const dNorm = Math.min(1.0, radius / parameters.radius);
            const mixedColor = new THREE.Color();
            
            if(dNorm < 0.25) {
                mixedColor.copy(colorCore).lerp(colorInner, smoothColorEase(dNorm / 0.25));
            } else {
                mixedColor.copy(colorInner).lerp(colorOut, smoothColorEase((dNorm - 0.25) / 0.75));
            }

            colors[i3    ] = mixedColor.r;
            colors[i3 + 1] = mixedColor.g;
            colors[i3 + 2] = mixedColor.b;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('aRandomness', new THREE.BufferAttribute(randomness, 3));
        
        if (!isDust) {
            geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
        }

        const material = new THREE.PointsMaterial({
            size: particleSize,
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true,
            transparent: true,
            opacity: opacity,
            map: texture,
            alphaTest: 0.005
        });

        material.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = { value: 0 };
            const twinkleDeclare = isDust ? '' : `attribute float aPhase; varying float vTwinkle;`;
            const twinkleCompute = isDust ? '' : `vTwinkle = 0.55 + 0.45 * sin(uTime * 2.2 + aPhase);`;

            shader.vertexShader = `
                uniform float uTime;
                attribute vec3 aRandomness;
                ${twinkleDeclare}
                ${shader.vertexShader}
            `.replace(
                `#include <begin_vertex>`,
                `
                vec3 transformed = vec3(position);
                float radio = length(transformed.xz);
                
                // Modelo Físico: Halo de Materia Oscura (Perfil Pseudo-Isotérmico)
                float vMax = 0.95;  // Velocidad límite extrema
                float rCore = 0.25; // Núcleo hiper-denso y concentrado
                
                // omega(r) = v(r) / r
                float omega = vMax / sqrt(radio * radio + rCore * rCore);
                float anguloGiro = uTime * omega; 
                
                float c = cos(anguloGiro);
                float s = sin(anguloGiro);
                mat2 matrizRotacion = mat2(c, s, -s, c);
                
                transformed.xz = matrizRotacion * transformed.xz;
                transformed += aRandomness;
                ${twinkleCompute}
                `
            );

            if (!isDust) {
                shader.fragmentShader = `
                    varying float vTwinkle;
                    ${shader.fragmentShader}
                `.replace(
                    `#include <dithering_fragment>`,
                    `
                    vec2 uvCentro = gl_PointCoord - vec2(0.5);
                    float distCentro = length(uvCentro) * 2.0;
                    float nucleoCaliente = smoothstep(0.55, 0.0, distCentro);
                    float halo = smoothstep(1.0, 0.15, distCentro);

                    gl_FragColor.rgb *= vTwinkle;
                    gl_FragColor.rgb += vec3(0.12, 0.09, 0.07) * nucleoCaliente * vTwinkle;
                    gl_FragColor.a *= mix(0.65, 1.0, halo);
                    #include <dithering_fragment>
                    `
                );
            }
            material.userData.shader = shader;
        };

        const points = new THREE.Points(geometry, material);
        points.userData.isAnimatedStarLayer = true;
        return points;
    }

    const dustLayer = buildLayer(dustCount, 0.135, nebulaTexture, 0.18, true);
    const starsLayer = buildLayer(starCount, 0.032, starTexture, 0.9, false);

    group.add(dustLayer);
    group.add(starsLayer);
    group.rotation.x = 0.20;
    group.rotation.z = -0.15;

    return group;
}

function createGalaxyStreakField(parameters) {
    const group = new THREE.Group();
    const count = 130;
    const palette = [new THREE.Color('#8bdcff'), new THREE.Color('#4e82ff'), new THREE.Color('#d4b7ff'), new THREE.Color('#fff0b6')];

    for (let i = 0; i < count; i++) {
        const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2;
        const radius = 0.9 + Math.pow(Math.random(), 0.62) * parameters.radius * 0.96;
        const spinAngle = radius * parameters.spin;
        const randomAngle = (Math.random() - 0.5) * 0.34;
        const angle = branchAngle + spinAngle + randomAngle;

        const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.20;
        const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.20;
        const y = (Math.random() - 0.5) * (0.34 + radius * 0.035);

        const color = palette[Math.floor(Math.random() * palette.length)].clone();

        const material = new THREE.SpriteMaterial({
            map: streakTexture,
            color,
            transparent: true,
            opacity: 0.055 + Math.random() * 0.060,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        material.rotation = angle + Math.PI * 0.5 + (Math.random() - 0.5) * 0.35;
        const streak = new THREE.Sprite(material);
        streak.position.set(x, y, z);
        streak.scale.set(0.38 + Math.random() * 0.92 + radius * 0.035, 0.030 + Math.random() * 0.030, 1);
        streak.userData = { baseOpacity: material.opacity, phase: Math.random() * Math.PI * 2, drift: 0.006 + Math.random() * 0.012 };
        group.add(streak);
    }
    return group;
}

function createQuasarJets() {
    const particleCount = 6000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);

    for(let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        // Distribución cilíndrica estrecha (colimación del campo magnético)
        const radius = Math.pow(Math.random(), 2.0) * 0.4; 
        const angle = Math.random() * Math.PI * 2;
        
        positions[i3] = Math.cos(angle) * radius;
        positions[i3 + 1] = (Math.random() - 0.5) * 15.0; // Altura del jet a lo largo de Y
        positions[i3 + 2] = Math.sin(angle) * radius;

        phases[i] = Math.random() * 10.0; // Fase para desfase de movimiento
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const material = new THREE.PointsMaterial({
        size: 0.2,
        sizeAttenuation: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        map: auraTexture,
        color: new THREE.Color('#7aabff') // Azul intenso característico de rayos X / sincrotrón
    });

    // Inyectamos física en el shader
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.vertexShader = `
            uniform float uTime;
            attribute float aPhase;
            varying float vAlpha;
            ${shader.vertexShader}
        `.replace(
            `#include <begin_vertex>`,
            `
            vec3 transformed = vec3(position);
            
            // Simular eyección relativista hacia afuera desde el núcleo (Y = 0)
            float speed = 9.0;
            float direction = sign(transformed.y); // Diferencia polos Norte/Sur
            
            // Ciclo de vida de la partícula: sube y reaparece
            transformed.y = direction * mod(abs(transformed.y) + uTime * speed + aPhase, 7.5);
            
            // Dinámica de colimación: el jet se ensancha al perder fuerza gravitacional
            float colimacion = 1.0 + abs(transformed.y) * 0.15;
            transformed.x *= colimacion;
            transformed.z *= colimacion;

            // Fade-in cerca del agujero negro y fade-out en los extremos
            float dist = abs(transformed.y);
            vAlpha = smoothstep(0.0, 1.2, dist) * smoothstep(7.5, 3.5, dist);
            `
        );

        shader.fragmentShader = `
            varying float vAlpha;
            ${shader.fragmentShader}
        `.replace(
            `vec4 diffuseColor = vec4( diffuse, opacity );`,
            `vec4 diffuseColor = vec4( diffuse, opacity * vAlpha );`
        );

        material.userData.shader = shader;
    };

    return new THREE.Points(geometry, material);
}

// ==========================================
// 3. INICIALIZACIÓN PRINCIPAL
// ==========================================

function createDeepSpaceBackground() {
    const bgGeo = new THREE.BufferGeometry();
    const bgCount = 15000;
    const bgPos = new Float32Array(bgCount * 3);
    
    for(let i = 0; i < bgCount; i++) {
        // Distribución esférica aleatoria (R = 40 a 100)
        const r = 40 + Math.random() * 60; 
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos((Math.random() * 2) - 1);
        
        bgPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        bgPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        bgPos[i * 3 + 2] = r * Math.cos(phi);
    }
    
    bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    const bgMat = new THREE.PointsMaterial({
        size: 0.12, 
        color: new THREE.Color('#5577ff'), 
        transparent: true, 
        opacity: 0.35, 
        sizeAttenuation: true, 
        map: starTexture, 
        depthWrite: false
    });
    
    return new THREE.Points(bgGeo, bgMat);
}

function initGalaxy() {
    const canvas = document.querySelector('#galaxy-canvas');
    galaxyScene = new THREE.Scene();

    const parameters = {
        radius: 7.0, branches: 5, spin: 1.2, 
        randomness: 0.32, randomnessPower: 3, densityPower: 2.2   
    };
    
    // 1. Galaxia Principal
    const unifiedGalaxy = createUnifiedGalaxy(parameters);
    galaxyScene.add(unifiedGalaxy);
    // Fondo del universo
    galaxyScene.add(createDeepSpaceBackground());

    // 2. Destello del Núcleo (Cuásar) y Jets
    galaxyCoreFlareGroup = new THREE.Group();
    galaxyJets = createQuasarJets();
    galaxyScene.add(galaxyJets);
    const flareGhosts = [
        { scale: 4.8, opacity: 0.95, color: '#ffffff' },
        { scale: 6.5, opacity: 0.50, color: '#ff9900' },
        { scale: 1.2, opacity: 0.25, color: '#ffd8a0' },
        { scale: 0.6, opacity: 0.15, color: '#a0c8ff' }
    ];
    flareGhosts.forEach((g) => {
        const mat = new THREE.SpriteMaterial({
            map: auraTexture, color: new THREE.Color(g.color),
            blending: THREE.AdditiveBlending, transparent: true,
            opacity: g.opacity, depthWrite: false
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(g.scale, g.scale, 1);
        sprite.userData = { baseOpacity: g.opacity, phase: Math.random() * Math.PI * 2 };
        galaxyCoreFlareGroup.add(sprite);
    });
    galaxyScene.add(galaxyCoreFlareGroup);

    // 3. Meteoritos y Estelas
    galaxyStreakField = createGalaxyStreakField(parameters);
    galaxyScene.add(galaxyStreakField);

    // --- CÁMARA Y RENDERER (¡Siempre antes del GPGPU!) ---
    galaxyCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    galaxyCamera.position.set(4, 3, 5);
    galaxyScene.add(galaxyCamera);

    galaxyRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    galaxyRenderer.setSize(window.innerWidth, window.innerHeight);
    galaxyRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    galaxyRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    galaxyRenderer.toneMappingExposure = 1.15;
    
    galaxyControls = new THREE.OrbitControls(galaxyCamera, canvas);
    galaxyControls.enableDamping = true;
    galaxyControls.dampingFactor = 0.055;
    galaxyControls.autoRotate = false;

    // --- 4. POLVO AMBIENTAL (CFD - GPGPU) ---
    initCFD(galaxyRenderer);

    const dustGeo = new THREE.BufferGeometry();
    const dustUvs = new Float32Array(TEX_WIDTH * TEX_WIDTH * 2);
    const dustPos = new Float32Array(TEX_WIDTH * TEX_WIDTH * 3); 
    
    let p = 0;
    for (let j = 0; j < TEX_WIDTH; j++) {
        for (let i = 0; i < TEX_WIDTH; i++) {
            dustUvs[p++] = i / (TEX_WIDTH - 1);
            dustUvs[p++] = j / (TEX_WIDTH - 1);
        }
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('uv', new THREE.BufferAttribute(dustUvs, 2));

    const dustMat = new THREE.ShaderMaterial({
        uniforms: { tPosition: { value: null }, map: { value: nebulaTexture } },
        vertexShader: `
            uniform sampler2D tPosition; varying vec2 vUv;
            void main() {
                vUv = uv; vec4 texPos = texture2D(tPosition, uv);
                vec4 mvPosition = modelViewMatrix * vec4(texPos.xyz, 1.0);
                gl_PointSize = 4.5 * (10.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D map;
            void main() {
                vec4 texColor = texture2D(map, gl_PointCoord);
                gl_FragColor = vec4(0.1, 0.34, 1.0, 0.15) * texColor;
            }
        `,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    });
    
    nearDustParticles = new THREE.Points(dustGeo, dustMat);
    galaxyScene.add(nearDustParticles);

    // --- POST-PROCESSING Y PASO 4 (LENTES GRAVITACIONALES) ---
    const renderScene = new THREE.RenderPass(galaxyScene, galaxyCamera);
    const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.58, 0.62, 0.42);
    
    galaxyComposer = new THREE.EffectComposer(galaxyRenderer);
    galaxyComposer.addPass(renderScene);
    galaxyComposer.addPass(bloomPass);

    blackHolePass = new THREE.ShaderPass({
        uniforms: {
            tDiffuse: { value: null },
            uCenter: { value: new THREE.Vector2(0.5, 0.5) },
            uMass: { value: 0.05 }, 
            uAspect: { value: window.innerWidth / window.innerHeight }
        },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
            uniform sampler2D tDiffuse; uniform vec2 uCenter; uniform float uMass; uniform float uAspect;
            varying vec2 vUv;
            void main() {
                vec2 uv = vUv;
                vec2 dir = uv - uCenter;
                dir.x *= uAspect; 
                
                float dist = length(dir);
                if(dist == 0.0) { gl_FragColor = texture2D(tDiffuse, uv); return; }

                float factor = uMass / dist;
                vec2 displacement = normalize(dir) * (factor * factor * 0.1);
                displacement.x /= uAspect; 
                
                vec2 distortedUv = uv - displacement;
                gl_FragColor = texture2D(tDiffuse, distortedUv);
            }
        `
    });
    galaxyComposer.addPass(blackHolePass);

    galaxyVignetteGrainPass = new THREE.ShaderPass({
        uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignetteStrength: { value: 0.38 }, uGrainStrength: { value: 0.045 } },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
            uniform sampler2D tDiffuse; uniform float uTime; uniform float uVignetteStrength; uniform float uGrainStrength;
            varying vec2 vUv;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453 + uTime * 0.7); }
            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                vec2 centered = vUv - 0.5;
                float vignette = 1.0 - dot(centered, centered) * uVignetteStrength;
                color.rgb *= clamp(vignette, 0.0, 1.0);
                color.rgb += (hash(vUv * vec2(1000.0, 1000.0)) - 0.5) * uGrainStrength;
                gl_FragColor = color;
            }
        `
    });
    galaxyComposer.addPass(galaxyVignetteGrainPass);

    window.addEventListener('resize', onWindowResize);
    tick(); 
}

// ==========================================
// 4. BUCLE DE ANIMACIÓN
// ==========================================

function tick() {
    const time = clock.getElapsedTime();

    if (galaxyScene) {
        galaxyScene.rotation.y = time * 0.015; 
        
        galaxyScene.traverse((child) => {
            if (child.isPoints && child.userData.isAnimatedStarLayer && child.material.userData.shader) {
                child.material.userData.shader.uniforms.uTime.value = time * 0.45; 
            }
        });

        if (galaxyJets && galaxyJets.material.userData.shader) {
            galaxyJets.material.userData.shader.uniforms.uTime.value = time;
        }
    }
    
    galaxyCamera.position.y += Math.sin(time * 0.5) * 0.003;
    galaxyCamera.position.x += Math.cos(time * 0.3) * 0.002;

    if (typeof gpuCompute !== 'undefined') {
        velocityVariable.material.uniforms.uTime.value = time;
        gpuCompute.compute();
        nearDustParticles.material.uniforms.tPosition.value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;
    }

    if (galaxyStreakField) {
        galaxyStreakField.rotation.y = Math.sin(time * 0.045) * 0.020;
        galaxyStreakField.rotation.z = Math.cos(time * 0.038) * 0.012;
        galaxyStreakField.children.forEach((streak, index) => {
            const phase = streak.userData.phase || 0;
            streak.material.opacity = streak.userData.baseOpacity * (0.72 + Math.sin(time * (0.55 + streak.userData.drift * 10) + phase + index * 0.07) * 0.28);
        });
    }

    if (galaxyCoreFlareGroup) {
        galaxyCoreFlareGroup.children.forEach((sprite) => {
            const wave = Math.sin(time * 0.6 + sprite.userData.phase);
            sprite.material.opacity = Math.max(0, sprite.userData.baseOpacity + wave * sprite.userData.baseOpacity * 0.25);
        });
    }

    // PASO 4: Actualizar posición del lente gravitacional
    if (blackHolePass && galaxyCamera) {
        const origin = new THREE.Vector3(0, 0, 0);
        origin.project(galaxyCamera); 
        
        if (origin.z < 1.0) {
            blackHolePass.uniforms.uCenter.value.set(
                (origin.x + 1) * 0.5,
                (origin.y + 1) * 0.5 // <--- CORRECCIÓN: Sin el signo negativo
            );
            blackHolePass.uniforms.uMass.value = 0.05; 
        } else {
            blackHolePass.uniforms.uMass.value = 0.0; 
        }
    }

    if (galaxyVignetteGrainPass) galaxyVignetteGrainPass.uniforms.uTime.value = time;

    galaxyControls.update();
    galaxyComposer.render();

    window.requestAnimationFrame(tick);
}

function onWindowResize() {
    galaxyCamera.aspect = window.innerWidth / window.innerHeight;
    galaxyCamera.updateProjectionMatrix();
    galaxyRenderer.setSize(window.innerWidth, window.innerHeight);
    galaxyComposer.setSize(window.innerWidth, window.innerHeight);
    if(blackHolePass) blackHolePass.uniforms.uAspect.value = window.innerWidth / window.innerHeight;
}

// Inicializar cuando se cargue la página
window.addEventListener('load', initGalaxy);