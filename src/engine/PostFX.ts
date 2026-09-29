import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Dark-fantasy colour grade applied after tone mapping:
 * cold desaturated shadows, warm highlights, gentle contrast and a heavy vignette.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.75 },
    uSaturation: { value: 0.88 },
    uContrast: { value: 1.08 },
    uShadowTint: { value: new THREE.Color(0.86, 0.9, 1.12) },
    uHighlightTint: { value: new THREE.Color(1.08, 0.98, 0.88) },
    uGrain: { value: 0.025 },
    uTime: { value: 0 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uContrast;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
    }

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, uSaturation);

      // Split toning: cool shadows, warm (firelit) highlights
      color *= mix(uShadowTint, uHighlightTint, smoothstep(0.08, 0.7, luma));

      color = (color - 0.5) * uContrast + 0.5;

      // Vignette pulls focus to the battlefield
      vec2 d = vUv - 0.5;
      float vig = 1.0 - dot(d, d) * uVignette;
      color *= clamp(vig, 0.0, 1.0);

      color += (hash(vUv * 731.0) - 0.5) * uGrain;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `
};

export class PostFX {
  private composer: EffectComposer;
  private gradePass: ShaderPass;
  public bloomPass: UnrealBloomPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, width: number, height: number) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    // Only genuinely bright things (runes, portals, lava, embers, spell VFX) bloom
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.6, 0.55, 0.82);
    this.composer.addPass(this.bloomPass);

    this.composer.addPass(new OutputPass());

    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);

    this.setSize(width, height, renderer.getPixelRatio());
  }

  setSize(width: number, height: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  render(time: number) {
    this.gradePass.uniforms.uTime.value = (time * 0.001) % 100;
    this.composer.render();
  }
}
