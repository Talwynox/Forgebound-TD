import * as THREE from 'three';

/** Finger travel (px) before a touch counts as a drag rather than a tap. */
const TAP_SLOP = 10;

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public target: THREE.Vector3;
  private domElement: HTMLElement;

  // Camera settings
  private distance: number = 44;
  private minDistance: number = 18;
  private maxDistance: number = 75;
  private pitch: number = 52 * (Math.PI / 180); // Isometric tilt
  private yaw: number = 0; // Top-down / side-view

  // Mouse drag interaction
  private isDragging: boolean = false;
  private previousMouseX: number = 0;
  private previousMouseY: number = 0;
  public isPlacementMode: () => boolean = () => false;

  // Touch gestures: one finger pans, two fingers pinch-zoom (and pan)
  private touches: Map<number, { x: number; y: number }> = new Map();
  private touchStart: { x: number; y: number } | null = null;
  private pinchStartDist = 0;
  private pinchStartZoom = 0;
  private dragGesture = false;

  // Horizontal pan limits (widened in PvP to include the Moon maze island)
  private minTargetX: number = -45;
  private maxTargetX: number = 38;

  // Keyboard navigation
  private keysPressed: Record<string, boolean> = {};

  constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    this.target = new THREE.Vector3(-6, 0, 0);

    const aspect = domElement.clientWidth / domElement.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 500);
    this.yaw = this.yawForAspect(aspect);

    this.updateCameraPosition();
    this.setupEventListeners();
  }

  /** Widens the pan range for the PvP battlefield and centres the view on a point. */
  public setPanRange(minX: number, maxX: number) {
    this.minTargetX = minX;
    this.maxTargetX = maxX;
    this.target.x = Math.max(minX, Math.min(maxX, this.target.x));
    this.updateCameraPosition();
  }

  public focusOn(x: number, z: number = 0) {
    this.target.set(Math.max(this.minTargetX, Math.min(this.maxTargetX, x)), this.target.y, z);
    this.updateCameraPosition();
  }

  /**
   * True once if the last pointer interaction was a drag/pinch (so the click it ends with
   * should not place a tower or select anything).
   */
  public consumeDragGesture(): boolean {
    const was = this.dragGesture;
    this.dragGesture = false;
    return was;
  }

  /**
   * The battlefield runs west→east (maze → arena). On portrait screens the view is turned 90° so
   * that long axis runs down the tall screen instead of being squeezed into its narrow width.
   */
  private yawForAspect(aspect: number): number {
    return aspect < 0.85 ? Math.PI / 2 : 0;
  }

  /** Pull the camera back on narrow screens so the battlefield still fits. */
  private get aspectFit(): number {
    const aspect = this.camera.aspect || 1;
    if (this.yaw !== 0) {
      // Rotated portrait: the narrow screen width spans the battlefield's depth (Z)
      return Math.min(2.4, 0.9 / aspect);
    }
    return aspect < 1.4 ? Math.pow(1.4 / aspect, 0.7) : 1;
  }

  private updateCameraPosition() {
    const d = this.distance * this.aspectFit;
    const x = this.target.x + d * Math.sin(this.yaw) * Math.cos(this.pitch);
    const y = this.target.y + d * Math.sin(this.pitch);
    const z = this.target.z + d * Math.cos(this.yaw) * Math.cos(this.pitch);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  /** Drag the ground under the pointer: screen deltas are mapped through the view's yaw. */
  private panBy(dx: number, dy: number) {
    const panSpeed = 0.04 * (this.distance * this.aspectFit / 35);
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    // Screen-right on the ground is (cos, -sin); screen-down is (sin, cos)
    const worldDx = (dx * cos + dy * sin) * panSpeed;
    const worldDz = (-dx * sin + dy * cos) * panSpeed;
    this.target.x = Math.max(this.minTargetX, Math.min(this.maxTargetX, this.target.x - worldDx));
    this.target.z = Math.max(-25, Math.min(25, this.target.z - worldDz));
    this.updateCameraPosition();
  }

  private setupEventListeners() {
    // Mouse drag for panning
    this.domElement.addEventListener('mousedown', (e: MouseEvent) => {
      // Middle click or right click or holding Shift + left click (when NOT in tower placement mode) for camera pan
      if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey && !this.isPlacementMode())) {
        this.isDragging = true;
        this.previousMouseX = e.clientX;
        this.previousMouseY = e.clientY;
        e.preventDefault();
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return;
      this.panBy(e.clientX - this.previousMouseX, e.clientY - this.previousMouseY);
      this.previousMouseX = e.clientX;
      this.previousMouseY = e.clientY;
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

    // Touch: drag to pan, pinch to zoom. Taps fall through as normal clicks.
    this.domElement.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 1) {
        this.touchStart = { x: e.clientX, y: e.clientY };
        this.dragGesture = false;
      } else if (this.touches.size === 2) {
        this.pinchStartDist = this.touchSpread();
        this.pinchStartZoom = this.distance;
        this.dragGesture = true;
      }
    });

    this.domElement.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !this.touches.has(e.pointerId)) return;
      const prevCenter = this.touchCenter();
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.touches.size === 1 && this.touchStart) {
        const moved = Math.hypot(e.clientX - this.touchStart.x, e.clientY - this.touchStart.y);
        if (moved > TAP_SLOP) this.dragGesture = true;
        if (this.dragGesture) {
          this.panBy(e.clientX - prevCenter.x, e.clientY - prevCenter.y);
        }
      } else if (this.touches.size >= 2) {
        const spread = this.touchSpread();
        if (this.pinchStartDist > 0 && spread > 0) {
          this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.pinchStartZoom * (this.pinchStartDist / spread)));
        }
        const center = this.touchCenter();
        this.panBy(center.x - prevCenter.x, center.y - prevCenter.y);
      }
    });

    const endTouch = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      this.touches.delete(e.pointerId);
      if (this.touches.size === 1) {
        // Continue panning with the remaining finger without a jump
        const [remaining] = this.touches.values();
        this.touchStart = { ...remaining };
      } else if (this.touches.size === 0) {
        this.touchStart = null;
      }
    };
    this.domElement.addEventListener('pointerup', endTouch);
    this.domElement.addEventListener('pointercancel', endTouch);

    // Keyboard keys (WASD / Arrows)
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      this.keysPressed[e.key.toLowerCase()] = true;
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keysPressed[e.key.toLowerCase()] = false;
    });
  }

  private touchCenter(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const t of this.touches.values()) {
      x += t.x;
      y += t.y;
    }
    const n = Math.max(1, this.touches.size);
    return { x: x / n, y: y / n };
  }

  private touchSpread(): number {
    const [a, b] = Array.from(this.touches.values());
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
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
      this.target.x = Math.max(this.minTargetX, Math.min(this.maxTargetX, this.target.x));
      this.target.z = Math.max(-20, Math.min(20, this.target.z));
      this.updateCameraPosition();
    }
  }

  handleResize() {
    const aspect = this.domElement.clientWidth / this.domElement.clientHeight;
    this.camera.aspect = aspect;
    this.yaw = this.yawForAspect(aspect);
    this.camera.updateProjectionMatrix();
    this.updateCameraPosition();
  }
}
