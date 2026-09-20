import * as THREE from 'three';

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public target: THREE.Vector3;
  private domElement: HTMLElement;

  // Camera settings
  private distance: number = 38;
  private minDistance: number = 18;
  private maxDistance: number = 60;
  private pitch: number = 52 * (Math.PI / 180); // Isometric tilt
  private yaw: number = 0; // Top-down / side-view

  // Drag interaction
  private isDragging: boolean = false;
  private previousMouseX: number = 0;
  private previousMouseY: number = 0;

  // Keyboard navigation
  private keysPressed: Record<string, boolean> = {};

  constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    this.target = new THREE.Vector3(0, 0, 0);

    const aspect = domElement.clientWidth / domElement.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 500);

    this.updateCameraPosition();
    this.setupEventListeners();
  }

  private updateCameraPosition() {
    const x = this.target.x + this.distance * Math.sin(this.yaw) * Math.cos(this.pitch);
    const y = this.target.y + this.distance * Math.sin(this.pitch);
    const z = this.target.z + this.distance * Math.cos(this.yaw) * Math.cos(this.pitch);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  private setupEventListeners() {
    // Mouse drag for panning
    this.domElement.addEventListener('mousedown', (e: MouseEvent) => {
      // Middle click or right click or holding Shift + left click for camera pan
      if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey)) {
        this.isDragging = true;
        this.previousMouseX = e.clientX;
        this.previousMouseY = e.clientY;
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.previousMouseX;
      const dy = e.clientY - this.previousMouseY;
      this.previousMouseX = e.clientX;
      this.previousMouseY = e.clientY;

      // Pan target based on camera distance
      const panSpeed = 0.04 * (this.distance / 35);
      this.target.x -= dx * panSpeed;
      this.target.z -= dy * panSpeed;

      // Clamp bounds
      this.target.x = Math.max(-35, Math.min(35, this.target.x));
      this.target.z = Math.max(-20, Math.min(20, this.target.z));

      this.updateCameraPosition();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Disable default context menu so right click can be used freely
    this.domElement.addEventListener('contextmenu', e => e.preventDefault());

    // Wheel zoom
    this.domElement.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        const zoomDelta = e.deltaY * 0.03;
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + zoomDelta));
        this.updateCameraPosition();
        e.preventDefault();
      },
      { passive: false }
    );

    // Keyboard keys (WASD / Arrows)
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      this.keysPressed[e.key.toLowerCase()] = true;
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keysPressed[e.key.toLowerCase()] = false;
    });
  }

  update(dt: number) {
    const moveSpeed = 16 * dt * (this.distance / 35);
    let moved = false;

    if (this.keysPressed['w'] || this.keysPressed['arrowup']) {
      this.target.z -= moveSpeed;
      moved = true;
    }
    if (this.keysPressed['s'] || this.keysPressed['arrowdown']) {
      this.target.z += moveSpeed;
      moved = true;
    }
    if (this.keysPressed['a'] || this.keysPressed['arrowleft']) {
      this.target.x -= moveSpeed;
      moved = true;
    }
    if (this.keysPressed['d'] || this.keysPressed['arrowright']) {
      this.target.x += moveSpeed;
      moved = true;
    }

    if (moved) {
      this.target.x = Math.max(-35, Math.min(35, this.target.x));
      this.target.z = Math.max(-20, Math.min(20, this.target.z));
      this.updateCameraPosition();
    }
  }

  handleResize() {
    const aspect = this.domElement.clientWidth / this.domElement.clientHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}

