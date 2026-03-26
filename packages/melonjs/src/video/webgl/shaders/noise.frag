precision highp float;

varying vec2 vRegion;
varying vec4 vColor;

uniform float u_time;
uniform float u_scale;
uniform float u_octaves;
uniform float u_persistence;
uniform float u_seed;
uniform vec2 u_resolution;
uniform bool u_seamless;
uniform float u_blendSkirt;

// Simplex noise implementation
vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
    return mod289(((x * 34.0) + 1.0) * x);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    // First corner
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    // Permutations
    i = mod289(i);
    vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    
    // Gradients: 7x7 points over a square, mapped onto an octahedron.
    float n_ = 0.142857142857; // 1.0/7.0
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z); // mod(p,7*7)
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_); // mod(j,N)
    
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fractalNoise(vec3 P, int octaves, float persistence) {
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    float maxValue = 0.0;
    
    for(int i = 0; i < 8; i++) {
        if(i >= octaves) break;
        
        value += snoise(P * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= 2.0;
    }
    
    return value / maxValue;
}

float sampleSeamlessNoise(vec2 pos, float time, int octaves, float persistence) {
    // Kalau seamless mati, langsung ambil noise biasa
    if (!u_seamless) {
        vec3 noisePos = vec3(pos.x + u_seed, pos.y + u_seed, time);
        return fractalNoise(noisePos, octaves, persistence);
    }

    // Normalized UV (0..1)
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    // Hitung offset tile (supaya noise tidak sama persis tiap kuadran)
    float tileSize = max(u_resolution.x, u_resolution.y) / (100.0 / u_scale);

    // Sample 4 kuadran noise
    float nA = fractalNoise(vec3(pos.x + u_seed,             pos.y + u_seed,             time), octaves, persistence); // A kiri atas
    float nB = fractalNoise(vec3(pos.x + u_seed + tileSize,  pos.y + u_seed,             time), octaves, persistence); // B kanan atas
    float nC = fractalNoise(vec3(pos.x + u_seed,             pos.y + u_seed + tileSize,  time), octaves, persistence); // C kiri bawah
    float nD = fractalNoise(vec3(pos.x + u_seed + tileSize,  pos.y + u_seed + tileSize,  time), octaves, persistence); // D kanan bawah

    // Swap diagonal → DCBA
    float qA = nD; // kiri atas pakai D
    float qB = nC; // kanan atas pakai C
    float qC = nB; // kiri bawah pakai B
    float qD = nA; // kanan bawah pakai A

    // Kalau blendSkirt = 0 → tampilkan langsung (hard cut)
    if (u_blendSkirt <= 0.0) {
        if (uv.x < 0.5 && uv.y < 0.5) return qA;
        if (uv.x >= 0.5 && uv.y < 0.5) return qB;
        if (uv.x < 0.5 && uv.y >= 0.5) return qC;
        return qD;
    }

    // Kalau ada blend → crossfade antar kuadran
    float tx = smoothstep(0.5 - u_blendSkirt, 0.5 + u_blendSkirt, uv.x);
    float ty = smoothstep(0.5 - u_blendSkirt, 0.5 + u_blendSkirt, uv.y);

    float top    = mix(qA, qB, tx);
    float bottom = mix(qC, qD, tx);
    return mix(top, bottom, ty);
}

                
float applyBlendSkirt(float noise, vec2 uv, float skirtSize) {
    if (skirtSize <= 0.0) return noise;

    // Hitung jarak dari edge (0.0 di tepi, 0.5 di tengah)
    float edgeDistX = min(uv.x, 1.0 - uv.x);
    float edgeDistY = min(uv.y, 1.0 - uv.y);
    float edgeDist = min(edgeDistX, edgeDistY);

    // Normalisasi ke [0..1] relatif terhadap setengah canvas
    float normDist = edgeDist / 0.5;

    // Falloff: 0 di edge, 1 di tengah
    float falloff = smoothstep(0.0, skirtSize, normDist);

    // Blend → dekat edge amplitudo mengecil tapi noise tetap ada
    return mix(0.5, noise, falloff);
}

void main() {
    // Use fragment coordinate in pixels for consistent scale
    vec2 pixelPos = gl_FragCoord.xy;
    vec2 pos = pixelPos / (100.0 / u_scale);
    
    // Get UV coordinates for blending operations
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    
    // Generate noise (seamless or regular)
    float noise = sampleSeamlessNoise(pos, u_time, int(u_octaves), u_persistence);
    
    // Normalize to 0-1 range
    noise = (noise + 1.0) * 0.5;
    
    // Apply blend skirt if enabled
    // noise = applyBlendSkirt(noise, uv, u_blendSkirt);
    
    // Output as grayscale
    gl_FragColor = vec4(vec3(noise), 1.0);
}