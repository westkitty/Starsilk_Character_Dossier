import * as THREE from "three";

export function bodyMaterial(color: string, emissive = 0, roughness = 0.72): THREE.MeshStandardMaterial {
  const c = new THREE.Color(color);
  return new THREE.MeshStandardMaterial({
    color: c,
    emissive: c,
    emissiveIntensity: emissive,
    roughness,
    metalness: 0.08,
    flatShading: true,
  });
}

export function atmosphereMaterial(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.16,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

export const bloodRingVertex = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  uniform float uTime;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 p = position;
    float s = sin(uv.x * 38.0 + uv.y * 11.0);
    float t = sin(uv.x * 17.0 - uv.y * 29.0);
    p += normal * (s * 0.045 + t * 0.03);
    vPos = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const bloodRingFragment = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  uniform float uTime;
  void main() {
    float bands = sin(vPos.x * 18.0 + vPos.z * 9.0) * 0.5 + 0.5;
    float ash = fract(sin(dot(vPos.xy, vec2(12.9898, 78.233))) * 43758.5453);
    vec3 crimson = vec3(0.55, 0.12, 0.18);
    vec3 black = vec3(0.05, 0.02, 0.03);
    vec3 vitrified = vec3(0.28, 0.04, 0.07);
    vec3 col = mix(black, crimson, bands);
    col = mix(col, vitrified, ash * 0.45);
    float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 1.4);
    col += rim * vec3(0.35, 0.05, 0.07);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function makeBloodRingMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: bloodRingVertex,
    fragmentShader: bloodRingFragment,
    side: THREE.DoubleSide,
  });
}

export const blackHoleVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

export const blackHoleFragment = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vView);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    vec3 col = vec3(0.01, 0.02, 0.03) + rim * vec3(0.18, 0.28, 0.34);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function makeBlackHoleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: blackHoleVertex,
    fragmentShader: blackHoleFragment,
  });
}
