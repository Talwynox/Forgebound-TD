import * as THREE from 'three';

export interface FloatingText {
  id: number;
  text: string;
  color: string;
  worldPos: THREE.Vector3;
  startTime: number;
  duration: number;
  element: HTMLElement;
}

export interface BeamVFX {
  line: THREE.Line;
  startTime: number;
  duration: number;
}

export class VFXManager {
  public scene: THREE.Scene;
  public camera: THREE.Camera;
  public domContainer: HTMLElement;

  private floatingTexts: FloatingText[] = [];
  private nextTextId = 1;

  private activeBeams: BeamVFX[] = [];
  private particleGroup: THREE.Group;

  constructor(scene: THREE.Scene, camera: THREE.Camera, domContainer: HTMLElement) {
    this.scene = scene;
    this.camera = camera;
    this.domContainer = domContainer;

    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);
  }

  spawnFloatingText(worldPos: THREE.Vector3, text: string, color: string = '#fde047', duration: number = 1.0) {
    const el = document.createElement('div');
    el.className = 'floating-combat-text';
    el.innerText = text;
    el.style.color = color;
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.fontWeight = 'bold';
    el.style.fontSize = '14px';
    el.style.textShadow = '0 0 4px #000, 1px 1px 2px #000';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.zIndex = '50';
    el.style.transition = 'opacity 0.2s ease-out';
    el.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    this.domContainer.appendChild(el);

    const fText: FloatingText = {
      id: this.nextTextId++,
      text,
      color,
      worldPos: worldPos.clone(),
      startTime: performance.now(),
      duration: duration * 1000,
      element: el
    };

    this.floatingTexts.push(fText);
  }

  spawnBeam(from: THREE.Vector3, to: THREE.Vector3, color: number = 0x38bdf8, duration: number = 0.15) {
    const points = [from.clone(), to.clone()];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2,
      transparent: true,
      opacity: 0.85
    });

    const line = new THREE.Line(geom, mat);
    this.scene.add(line);

    this.activeBeams.push({
      line,
      startTime: performance.now(),
      duration: duration * 1000
    });
  }

  spawnAscensionPillar(pos: THREE.Vector3, color: number = 0xc084fc) {
    const geom = new THREE.CylinderGeometry(0.8, 1.2, 8, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(pos.x, 4, pos.z);
    this.scene.add(mesh);

    const startTime = performance.now();
    const duration = 800;

    const animatePillar = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;
      if (progress >= 1) {
        this.scene.remove(mesh);
        geom.dispose();
        mat.dispose();
      } else {
        mesh.rotation.y += 0.08;
        mesh.scale.x = 1 + progress * 0.5;
        mesh.scale.z = 1 + progress * 0.5;
        mat.opacity = 0.7 * (1 - progress);
        requestAnimationFrame(animatePillar);
      }
    };
    animatePillar();
  }

  spawnBurstParticles(pos: THREE.Vector3, color: number = 0xfacc15, count: number = 10) {
    const pGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y + 0.5;
      positions[i * 3 + 2] = pos.z;

      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 3 + 1,
          (Math.random() - 0.5) * 3
        )
      );
    }

    pGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: color,
      size: 0.18,
      transparent: true,
      opacity: 0.9
    });

    const pSystem = new THREE.Points(pGeom, pMat);
    this.scene.add(pSystem);

    const startTime = performance.now();
    const duration = 500;

    const animateParticles = () => {
      const elapsed = performance.now() - startTime;
      const progress = elapsed / duration;
      if (progress >= 1) {
        this.scene.remove(pSystem);
        pGeom.dispose();
        pMat.dispose();
      } else {
        const dt = 0.016;
        const posAttr = pGeom.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < count; i++) {
          velocities[i].y -= 9.8 * dt * 0.5; // gravity
          posAttr.setXYZ(
            i,
            posAttr.getX(i) + velocities[i].x * dt,
            posAttr.getY(i) + velocities[i].y * dt,
            posAttr.getZ(i) + velocities[i].z * dt
          );
        }
        posAttr.needsUpdate = true;
        pMat.opacity = 0.9 * (1 - progress);
        requestAnimationFrame(animateParticles);
      }
    };
    animateParticles();
  }

  update() {
    const now = performance.now();

    // Update floating combat texts
    const width = this.domContainer.clientWidth;
    const height = this.domContainer.clientHeight;
    const tempVec = new THREE.Vector3();

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      const elapsed = now - ft.startTime;
      const progress = elapsed / ft.duration;

      if (progress >= 1) {
        if (ft.element.parentElement) {
          ft.element.parentElement.removeChild(ft.element);
        }
        this.floatingTexts.splice(i, 1);
      } else {
        // Float upward in world space
        tempVec.copy(ft.worldPos);
        tempVec.y += progress * 1.6;

        // Project to 2D screen coordinates
        tempVec.project(this.camera);

        const screenX = (tempVec.x * 0.5 + 0.5) * width;
        const screenY = (-(tempVec.y * 0.5) + 0.5) * height;

        ft.element.style.left = `${screenX}px`;
        ft.element.style.top = `${screenY}px`;
        ft.element.style.opacity = `${1 - progress * 0.8}`;
      }
    }

    // Update active laser/beam effects
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      const beam = this.activeBeams[i];
      const elapsed = now - beam.startTime;
      const progress = elapsed / beam.duration;

      if (progress >= 1) {
        this.scene.remove(beam.line);
        beam.line.geometry.dispose();
        (beam.line.material as THREE.Material).dispose();
        this.activeBeams.splice(i, 1);
      } else {
        const mat = beam.line.material as THREE.LineBasicMaterial;
        mat.opacity = 0.85 * (1 - progress);
      }
    }
  }
}
