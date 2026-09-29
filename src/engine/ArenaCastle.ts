import * as THREE from 'three';
import { createMasonryTexture } from './ProceduralTextures';
import { VFXManager } from '../vfx/VFXManager';
import { audio } from './AudioSystem';

/**
 * Physical Arena Castle (Player's Stronghold) placed in the Grand Arena
 * behind the Arrival Portal and Portal Guardian Bastions.
 *
 * Remaining enemy units that break through friendly defenders will march
 * directly on this stronghold, attack its gates and walls, and destroy it
 * if not intercepted. Its destruction triggers mission defeat.
 */
export class ArenaCastle {
  private scene: THREE.Scene;
  private vfx: VFXManager;

  public group: THREE.Group;
  public hpBarGroup: THREE.Group;
  public position: THREE.Vector3;
  public gateTargetPos: THREE.Vector3;

  public maxHp: number;
  public currentHp: number;
  public isDestroyed: boolean = false;

  // 3D Visual elements
  private keepInnerGroup: THREE.Group;
  private towerGroups: THREE.Group[] = [];
  private flashMaterials: THREE.MeshStandardMaterial[] = [];
  private originalEmissives: Map<THREE.MeshStandardMaterial, { color: number; intensity: number }> = new Map();

  // Animation timers
  private shakeTimer: number = 0;
  private flashTimer: number = 0;

  // 3D Health bar components (matching UnitManager medieval aesthetic)
  private hpBarBorderMesh!: THREE.Mesh;
  private hpBarBgMesh!: THREE.Mesh;
  private hpBarMesh!: THREE.Mesh;
  private hpBarGlossMesh!: THREE.Mesh;
  private fillWidth: number = 4.88;
  private fillHeight: number = 0.32;

  private textCanvas!: HTMLCanvasElement;
  private textCtx!: CanvasRenderingContext2D;
  private textTexture!: THREE.CanvasTexture;
  private textSprite!: THREE.Sprite;

  public isMoonTeam: boolean = false;
  public castleTitle: string = '🏰 STRONGHOLD';

  constructor(
    scene: THREE.Scene,
    vfx: VFXManager,
    maxHp: number = 800,
    customPos?: THREE.Vector3,
    isMoonTeam: boolean = false
  ) {
    this.scene = scene;
    this.vfx = vfx;
    this.maxHp = maxHp;
    this.currentHp = maxHp;
    this.isMoonTeam = isMoonTeam;
    this.castleTitle = isMoonTeam ? '🌙 MOON STRONGHOLD' : '☀️ SUN STRONGHOLD';

    if (customPos) {
      this.position = customPos.clone();
      this.gateTargetPos = isMoonTeam
        ? new THREE.Vector3(customPos.x - 1.7, 0, customPos.z)
        : new THREE.Vector3(customPos.x + 1.7, 0, customPos.z);
    } else {
      // Placed at the western edge of the arena (X = -0.4, Z = 0)
      // Front gate faces East (+X) at X = 1.3, directly behind the arrival pad (X = 1.8)
      this.position = new THREE.Vector3(-0.4, 0, 0);
      this.gateTargetPos = new THREE.Vector3(1.3, 0, 0);
    }

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    if (isMoonTeam) {
      this.group.rotation.y = Math.PI; // Face West towards arena center
    }

    this.keepInnerGroup = new THREE.Group();
    this.group.add(this.keepInnerGroup);

    this.hpBarGroup = new THREE.Group();
    // Elevated cleanly above the central spire (-0.4, 11.7) connected by the gilded pinnacle standard
    this.hpBarGroup.position.set(-0.4, 13.2, 0);
    this.group.add(this.hpBarGroup);

    this.buildVisuals();
    this.buildHpBar();
    this.updateHpBar();

    this.scene.add(this.group);
  }

  private buildVisuals() {
    // Medieval Stone & Fortress Palette Materials
    const foundationPlinthMat = new THREE.MeshStandardMaterial({
      color: 0x241c16, // Chiseled dark granite foundation
      roughness: 0.9,
      metalness: 0.1
    });

    const teamGlow = this.isMoonTeam ? 0xff3b2a : 0x60a5fa;
    const teamCloth = this.isMoonTeam ? 0x7a1522 : 0x2f4a8a;

    const fortressAshlarMat = new THREE.MeshStandardMaterial({
      color: 0xc4b4a0, // Tints the weathered ashlar masonry texture
      map: createMasonryTexture(2, 2),
      roughness: 0.85,
      metalness: 0.05
    });

    const stoneTrimMat = new THREE.MeshStandardMaterial({
      color: 0x8a7a68, // Carved limestone battlements & corbels
      roughness: 0.75,
      metalness: 0.08
    });

    const royalBlueSlateMat = new THREE.MeshStandardMaterial({
      color: this.isMoonTeam ? 0x341015 : 0x232838, // Team-tinted weathered slate spires
      roughness: 0.55,
      metalness: 0.3
    });

    const gildedGoldMat = new THREE.MeshStandardMaterial({
      color: 0xc9a45a, // Antique heraldic gold ornaments & crests
      metalness: 0.85,
      roughness: 0.25
    });

    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a30, // Wrought iron portcullis, wall bands & sconces
      metalness: 0.85,
      roughness: 0.3
    });

    const woodOakMat = new THREE.MeshStandardMaterial({
      color: 0x3d1d0c, // Heavy iron-banded dark oak doors
      roughness: 0.85
    });

    const glowingWindowMat = new THREE.MeshStandardMaterial({
      color: 0xffd8a8,
      emissive: 0xff9a3c,
      emissiveIntensity: 2.2
    });

    const arcaneBeaconMat = new THREE.MeshStandardMaterial({
      color: teamGlow,
      emissive: teamGlow,
      emissiveIntensity: 2.6
    });

    const bannerClothMat = new THREE.MeshStandardMaterial({
      color: teamCloth,
      roughness: 0.9,
      side: THREE.DoubleSide
    });

    // Register materials that flash red on impact
    const matsToTrack = [fortressAshlarMat, stoneTrimMat, woodOakMat];
    for (const mat of matsToTrack) {
      this.flashMaterials.push(mat);
      this.originalEmissives.set(mat, {
        color: mat.emissive ? mat.emissive.getHex() : 0x000000,
        intensity: mat.emissiveIntensity || 0
      });
    }

    // 1. Bedrock Foundation & Chasm Pier Buttresses
    // Main raised terrace (X: 3.8, Y: 0.5, Z: 7.2)
    const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.5, 7.2), foundationPlinthMat);
    basePlinth.position.set(-0.3, 0.22, 0);
    basePlinth.receiveShadow = true;
    this.keepInnerGroup.add(basePlinth);

    // Deep subterranean foundation block hanging over the abyss
    const abyssPillar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 6.8), foundationPlinthMat);
    abyssPillar.position.set(-1.4, -1.6, 0);
    abyssPillar.receiveShadow = true;
    this.keepInnerGroup.add(abyssPillar);

    // Angled stone foundation buttresses anchored into bedrock
    [-2.4, -0.8, 0.8, 2.4].forEach(zCorbel => {
      const buttress = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 3.6, 6), foundationPlinthMat);
      buttress.position.set(-1.8, -1.2, zCorbel);
      buttress.rotation.z = 0.35;
      this.keepInnerGroup.add(buttress);
    });

    // Broad entrance stone steps in front of the gate (facing +X towards Arena)
    const steps = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 3.6), stoneTrimMat);
    steps.position.set(1.5, 0.12, 0);
    steps.receiveShadow = true;
    this.keepInnerGroup.add(steps);

    // 2. Main Donjon (Central Royal Keep)
    // Lower Great Hall
    const keepLower = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.0, 4.6), fortressAshlarMat);
    keepLower.position.set(-0.4, 2.2, 0);
    keepLower.castShadow = true;
    keepLower.receiveShadow = true;
    this.keepInnerGroup.add(keepLower);

    // Middle Fortress Tier
    const keepMid = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 3.8), fortressAshlarMat);
    keepMid.position.set(-0.4, 5.0, 0);
    keepMid.castShadow = true;
    keepMid.receiveShadow = true;
    this.keepInnerGroup.add(keepMid);

    // Machicolation Overhang & Corbel Ring
    const corbelLedge = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.35, 4.2), stoneTrimMat);
    corbelLedge.position.set(-0.4, 6.25, 0);
    corbelLedge.castShadow = true;
    this.keepInnerGroup.add(corbelLedge);

    // Rooftop Merlons / Crenellations
    [-1.7, 0.9].forEach(xOff => {
      [-1.8, -0.6, 0.6, 1.8].forEach(zOff => {
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.45, 0.4), stoneTrimMat);
        merlon.position.set(-0.4 + xOff * 0.7, 6.6, zOff);
        this.keepInnerGroup.add(merlon);
      });
    });

    // Upper Belfry Tower
    const belfry = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.88, 2.4, 8), fortressAshlarMat);
    belfry.position.set(-0.4, 7.5, 0);
    belfry.castShadow = true;
    this.keepInnerGroup.add(belfry);

    // Grand Cobalt Spire Roof
    const belfryRoof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.6, 8), royalBlueSlateMat);
    belfryRoof.position.set(-0.4, 9.8, 0);
    belfryRoof.castShadow = true;
    this.keepInnerGroup.add(belfryRoof);

    // Gilded Finial & Arcane Pinnacle Beacon
    const finialRod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), gildedGoldMat);
    finialRod.position.set(-0.4, 11.2, 0);
    this.keepInnerGroup.add(finialRod);

    const beaconCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.26), arcaneBeaconMat);
    beaconCrystal.position.set(-0.4, 11.7, 0);
    this.keepInnerGroup.add(beaconCrystal);

    const beaconLight = new THREE.PointLight(teamGlow, 1.8, 14, 1.6);
    beaconLight.position.set(-0.4, 11.7, 0);
    this.keepInnerGroup.add(beaconLight);

    // Gilded mounting rod connecting donjon spire to elevated HP badge
    const bannerRod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), gildedGoldMat);
    bannerRod.position.set(-0.4, 12.4, 0);
    this.keepInnerGroup.add(bannerRod);

    // Rose Window on Front Face (East)
    const roseWindow = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 12), glowingWindowMat);
    roseWindow.rotation.z = Math.PI / 2;
    roseWindow.position.set(0.92, 4.6, 0);
    this.keepInnerGroup.add(roseWindow);

    // 3. Grand Gatehouse & Portcullis (Facing Arena)
    const gatehouse = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.4, 2.8), fortressAshlarMat);
    gatehouse.position.set(1.0, 1.8, 0);
    gatehouse.castShadow = true;
    gatehouse.receiveShadow = true;
    this.keepInnerGroup.add(gatehouse);

    const gateCoping = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3, 3.0), stoneTrimMat);
    gateCoping.position.set(1.0, 3.55, 0);
    this.keepInnerGroup.add(gateCoping);

    // Double Reinforced Oak Doors
    const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 0.7), woodOakMat);
    doorL.position.set(1.48, 1.15, -0.38);
    doorL.castShadow = true;
    this.keepInnerGroup.add(doorL);

    const doorR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 0.7), woodOakMat);
    doorR.position.set(1.48, 1.15, 0.38);
    doorR.castShadow = true;
    this.keepInnerGroup.add(doorR);

    // Iron Portcullis Grill
    const portcullis = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 1.5), darkIronMat);
    portcullis.position.set(1.52, 2.1, 0);
    this.keepInnerGroup.add(portcullis);

    // Royal Crest Shield above Entrance
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.5), gildedGoldMat);
    crest.position.set(1.62, 2.95, 0);
    this.keepInnerGroup.add(crest);

    // Sconce Torches with warm lights flanking gate
    [-1.2, 1.2].forEach(zL => {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), darkIronMat);
      bracket.position.set(1.6, 2.1, zL);
      this.keepInnerGroup.add(bracket);

      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), glowingWindowMat);
      lantern.position.set(1.75, 2.05, zL);
      this.keepInnerGroup.add(lantern);

      const torchLight = new THREE.PointLight(0xff8a3a, 1.6, 7, 1.7);
      torchLight.position.set(1.85, 2.05, zL);
      this.keepInnerGroup.add(torchLight);
    });

    // 4. Twin Flanking Sentry Bastion Towers
    [
      { z: 2.7, name: 'North Sentry Tower' },
      { z: -2.7, name: 'South Sentry Tower' }
    ].forEach((tDef, idx) => {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(0.1, 0, tDef.z);

      // Lower cylinder tower
      const tBase = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 5.8, 8), fortressAshlarMat);
      tBase.position.y = 2.9;
      tBase.castShadow = true;
      tBase.receiveShadow = true;
      towerGroup.add(tBase);

      // Corbel gallery
      const tGallery = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.8, 0.4, 8), stoneTrimMat);
      tGallery.position.y = 5.85;
      towerGroup.add(tGallery);

      // Crenellations
      for (let m = 0; m < 4; m++) {
        const mAngle = (m * Math.PI) / 2 + Math.PI / 4;
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, 0.28), stoneTrimMat);
        merlon.position.set(Math.cos(mAngle) * 0.88, 6.2, Math.sin(mAngle) * 0.88);
        towerGroup.add(merlon);
      }

      // Conical roof
      const tRoof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 8), royalBlueSlateMat);
      tRoof.position.y = 7.15;
      tRoof.castShadow = true;
      towerGroup.add(tRoof);

      // Gilded finial
      const tFinial = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), gildedGoldMat);
      tFinial.position.y = 8.35;
      towerGroup.add(tFinial);

      // Team banner facing the arena, with a glowing sigil
      const banner = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.8, 0.45), bannerClothMat);
      banner.position.set(0.88, 4.2, 0);
      towerGroup.add(banner);

      const sigil = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), arcaneBeaconMat);
      sigil.position.set(0.91, 4.45, 0);
      sigil.scale.set(0.3, 1.3, 1);
      towerGroup.add(sigil);

      const bTrim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.47), gildedGoldMat);
      bTrim.position.set(0.88, 3.25, 0);
      towerGroup.add(bTrim);

      this.towerGroups.push(towerGroup);
      this.keepInnerGroup.add(towerGroup);
    });
  }

  private buildHpBar() {
    const width = 5.2;
    const height = 0.42;
    this.fillWidth = width - 0.12;
    this.fillHeight = height - 0.08;

    // Gilded bracket crossbar anchoring the heraldic health bar frame
    const crossbeam = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.6, 0.06, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.25 })
    );
    crossbeam.position.set(0, 0, -0.01);
    this.hpBarGroup.add(crossbeam);

    // 1. Drop Shadow Background (deep slate shadow)
    const shadowGeom = new THREE.PlaneGeometry(width + 0.24, height + 0.16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeom, shadowMat);
    shadowMesh.renderOrder = 9990;
    shadowMesh.position.z = -0.004;
    this.hpBarGroup.add(shadowMesh);

    // 2. Metallic Beveled Border (golden bronze, switches to red on critical damage)
    const borderGeom = new THREE.PlaneGeometry(width + 0.08, height + 0.06);
    const borderMat = new THREE.MeshBasicMaterial({
      color: 0xd97706,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    this.hpBarBorderMesh = new THREE.Mesh(borderGeom, borderMat);
    this.hpBarBorderMesh.renderOrder = 9991;
    this.hpBarBorderMesh.position.z = -0.002;
    this.hpBarGroup.add(this.hpBarBorderMesh);

    // 3. Dark Recessed Trough (Background where depleted HP shows)
    const barBgGeom = new THREE.PlaneGeometry(width, height);
    const barBgMat = new THREE.MeshBasicMaterial({
      color: 0x141416,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    this.hpBarBgMesh = new THREE.Mesh(barBgGeom, barBgMat);
    this.hpBarBgMesh.renderOrder = 9992;
    this.hpBarBgMesh.position.z = 0;
    this.hpBarGroup.add(this.hpBarBgMesh);

    // 4. Dynamic Health Fill Mesh
    const barGeom = new THREE.PlaneGeometry(this.fillWidth, this.fillHeight);
    const barMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    this.hpBarMesh = new THREE.Mesh(barGeom, barMat);
    this.hpBarMesh.renderOrder = 9993;
    this.hpBarMesh.position.z = 0.002;
    this.hpBarGroup.add(this.hpBarMesh);

    // 5. Glassy Top Sheen / Gloss Strip (gives polished AAA game look)
    const glossGeom = new THREE.PlaneGeometry(this.fillWidth, this.fillHeight * 0.44);
    const glossMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    this.hpBarGlossMesh = new THREE.Mesh(glossGeom, glossMat);
    this.hpBarGlossMesh.renderOrder = 9994;
    this.hpBarGlossMesh.position.set(0, this.fillHeight * 0.26, 0.004);
    this.hpBarGroup.add(this.hpBarGlossMesh);

    // 6. Tactical Fortress Pip Dividers (dividing health into 5 readable sections)
    [-0.3, -0.1, 0.1, 0.3].forEach(pct => {
      const tickGeom = new THREE.PlaneGeometry(0.024, this.fillHeight);
      const tickMat = new THREE.MeshBasicMaterial({
        color: 0x09090b,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false
      });
      const tickMesh = new THREE.Mesh(tickGeom, tickMat);
      tickMesh.renderOrder = 9995;
      tickMesh.position.set(this.fillWidth * pct, 0, 0.005);
      this.hpBarGroup.add(tickMesh);
    });

    // 7. Flanking Heraldic Gold Bosses / Crest Badges with Azure Gemstones
    const crestMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.25,
      depthTest: false,
      depthWrite: false
    });
    [-1, 1].forEach(side => {
      const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), crestMat);
      crest.renderOrder = 9996;
      crest.position.set(side * (width * 0.5 + 0.18), 0, 0.01);
      crest.rotation.z = Math.PI / 4;
      this.hpBarGroup.add(crest);

      const gem = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.8,
          depthTest: false,
          depthWrite: false
        })
      );
      gem.renderOrder = 9997;
      gem.position.set(side * (width * 0.5 + 0.18), 0, 0.02);
      this.hpBarGroup.add(gem);
    });

    // 8. Crisp In-World Medieval Header Badge (High-Resolution Floating Text)
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 768;
    this.textCanvas.height = 144;
    this.textCtx = this.textCanvas.getContext('2d')!;
    this.textTexture = new THREE.CanvasTexture(this.textCanvas);
    this.textTexture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.textTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    this.textSprite = new THREE.Sprite(spriteMat);
    this.textSprite.renderOrder = 9999;
    this.textSprite.position.set(0, 0.48, 0.01);
    this.textSprite.scale.set(4.2, 0.78, 1.0);
    this.hpBarGroup.add(this.textSprite);
  }

  public updateHpBar() {
    if (!this.hpBarMesh || !this.textCtx) return;

    const hpRatio = Math.max(0, Math.min(1, this.currentHp / this.maxHp));

    // Dynamic scale and offset of the health bar fill (anchored to left edge)
    this.hpBarMesh.scale.x = hpRatio;
    this.hpBarMesh.position.x = -(1 - hpRatio) * (this.fillWidth * 0.5);

    if (this.hpBarGlossMesh) {
      this.hpBarGlossMesh.scale.x = hpRatio;
      this.hpBarGlossMesh.position.x = -(1 - hpRatio) * (this.fillWidth * 0.5);
    }

    // Dynamic health fill color & border color matching the world aesthetic
    const fillMat = this.hpBarMesh.material as THREE.MeshBasicMaterial;
    const borderMat = this.hpBarBorderMesh.material as THREE.MeshBasicMaterial;

    if (hpRatio < 0.25) {
      fillMat.color.setHex(0xef4444); // Urgent crimson
      borderMat.color.setHex(0xef4444);
    } else if (hpRatio < 0.5) {
      fillMat.color.setHex(0xf59e0b); // Warning amber
      borderMat.color.setHex(0xd97706);
    } else {
      fillMat.color.setHex(0x10b981); // Vibrant emerald green
      borderMat.color.setHex(0xd97706);
    }

    // Redraw crisp text badge
    const ctx = this.textCtx;
    const w = 768;
    const h = 144;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px "Cinzel", "Segoe UI", Arial, serif, sans-serif';

    const currentFormatted = Math.round(this.currentHp).toLocaleString();
    const maxFormatted = this.maxHp.toLocaleString();
    const text = `${this.castleTitle}  •  ${currentFormatted} / ${maxFormatted} HP`;

    // Heavy dark drop-shadow and stroke outline for 100% readability against any scene backdrop
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(text, w / 2, h / 2);

    // Medieval gold / white gradient text fill
    const grad = ctx.createLinearGradient(0, h / 2 - 22, 0, h / 2 + 22);
    if (hpRatio < 0.25) {
      grad.addColorStop(0, '#fca5a5');
      grad.addColorStop(1, '#ef4444');
    } else if (hpRatio < 0.5) {
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(1, '#f59e0b');
    } else {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#fde047');
    }
    ctx.fillStyle = grad;
    ctx.fillText(text, w / 2, h / 2);
    ctx.restore();

    this.textTexture.needsUpdate = true;
  }

  /**
   * Adds fortification bonus to both maxHp and currentHp between waves.
   * This strengthens the castle's maximum pool without healing unhealed damage!
   */
  public addWaveFortification(bonusHp: number) {
    if (this.isDestroyed) return;

    this.maxHp += bonusHp;
    this.currentHp += bonusHp;

    // Visual & audio feedback of stronghold fortification
    audio.playArmorBuff();
    this.vfx.spawnAscensionPillar(new THREE.Vector3(this.position.x + 0.8, 0, this.position.z), 0x38bdf8);
    this.vfx.spawnBurstParticles(new THREE.Vector3(this.position.x + 0.8, 4.0, this.position.z), 0xfacc15, 18);
    this.vfx.spawnFloatingText(
      new THREE.Vector3(this.position.x + 1.2, 5.2, this.position.z),
      `🛡️ STRONGHOLD FORTIFIED: +${bonusHp} MAX HP!`,
      '#38bdf8',
      2.5
    );

    this.updateHpBar();
  }

  /**
   * Applies damage to the Arena Castle from an attacking unit.
   * Returns true if the castle was destroyed by this hit.
   */
  public takeDamage(amount: number, hitPos?: THREE.Vector3): boolean {
    if (this.isDestroyed) return false;

    this.currentHp = Math.max(0, this.currentHp - amount);

    // Trigger visual hit flinch & flash
    this.shakeTimer = 0.16;
    this.flashTimer = 0.14;

    for (const mat of this.flashMaterials) {
      mat.emissive.setHex(0xdc2626);
      mat.emissiveIntensity = 0.75;
    }

    // Audio & particles
    audio.playHit();

    const spawnPos = hitPos ? hitPos.clone() : this.gateTargetPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.vfx.spawnBurstParticles(spawnPos, 0xf97316, 8);
    this.vfx.spawnFloatingText(spawnPos.clone().add(new THREE.Vector3(0, 0.4, 0)), `-${amount}`, '#ef4444', 1.2);

    this.updateHpBar();

    if (this.currentHp <= 0) {
      this.triggerDestruction();
      return true;
    }

    return false;
  }

  /**
   * Multiplayer client: mirror the host's castle state. Hit/destruction VFX arrive separately
   * through FX replay, so only the local visual state (flinch, HP bar, collapse) is updated here.
   */
  public applyNetworkState(currentHp: number, maxHp: number, destroyed: boolean) {
    if (currentHp < this.currentHp && !destroyed) {
      this.shakeTimer = 0.16;
      this.flashTimer = 0.14;
      for (const mat of this.flashMaterials) {
        mat.emissive.setHex(0xdc2626);
        mat.emissiveIntensity = 0.75;
      }
    }
    this.currentHp = currentHp;
    this.maxHp = maxHp;
    if (destroyed && !this.isDestroyed) {
      this.isDestroyed = true;
      this.hpBarGroup.visible = false;
    }
    this.updateHpBar();
  }

  public triggerDestruction() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    audio.playDefeat();

    // Multistage explosion and destruction VFX across the castle
    const pos = this.position;
    this.vfx.spawnBurstParticles(new THREE.Vector3(pos.x, 3.0, pos.z), 0xff4500, 30);
    this.vfx.spawnBurstParticles(new THREE.Vector3(pos.x + 1.2, 1.8, pos.z), 0xfacc15, 25);
    this.vfx.spawnBurstParticles(new THREE.Vector3(pos.x + 0.1, 4.0, pos.z + 2.7), 0xef4444, 20);
    this.vfx.spawnBurstParticles(new THREE.Vector3(pos.x + 0.1, 4.0, pos.z - 2.7), 0xef4444, 20);
    this.vfx.spawnFlamePuff(new THREE.Vector3(pos.x + 0.8, 1.6, pos.z), 0xf97316);
    this.vfx.spawnFloatingText(new THREE.Vector3(pos.x + 1.2, 3.8, pos.z), '💥 ARENA STRONGHOLD DESTROYED! 💥', '#ef4444', 3.0);

    // Hide HP bar on collapse
    this.hpBarGroup.visible = false;
  }

  public reset(newMaxHp: number = 800) {
    this.isDestroyed = false;
    this.maxHp = newMaxHp;
    this.currentHp = newMaxHp;
    this.hpBarGroup.visible = true;

    this.shakeTimer = 0;
    this.flashTimer = 0;

    // Reset positions & rotations
    this.keepInnerGroup.position.set(0, 0, 0);
    this.keepInnerGroup.rotation.set(0, 0, 0);

    this.towerGroups.forEach(tg => {
      tg.position.y = 0;
      tg.rotation.set(0, 0, 0);
    });

    // Reset material emissives
    for (const mat of this.flashMaterials) {
      const orig = this.originalEmissives.get(mat);
      if (orig) {
        mat.emissive.setHex(orig.color);
        mat.emissiveIntensity = orig.intensity;
      }
    }

    this.updateHpBar();
  }

  public update(dt: number, camera: THREE.Camera) {
    // Billboard HP bar towards camera
    if (this.hpBarGroup && this.hpBarGroup.visible) {
      this.hpBarGroup.quaternion.copy(camera.quaternion);
    }

    // Hit flinch shake decay
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const progress = this.shakeTimer / 0.16;
      this.keepInnerGroup.position.x = (Math.random() - 0.5) * 0.14 * progress;
      this.keepInnerGroup.position.z = (Math.random() - 0.5) * 0.14 * progress;
      if (this.shakeTimer <= 0) {
        this.keepInnerGroup.position.set(0, 0, 0);
      }
    }

    // Material flash decay
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        for (const mat of this.flashMaterials) {
          const orig = this.originalEmissives.get(mat);
          if (orig) {
            mat.emissive.setHex(orig.color);
            mat.emissiveIntensity = orig.intensity;
          }
        }
      }
    }

    // Sinking / crumbling debris animation upon defeat
    if (this.isDestroyed) {
      if (this.keepInnerGroup.position.y > -1.4) {
        this.keepInnerGroup.position.y -= dt * 0.9;
        this.keepInnerGroup.rotation.z += dt * 0.08;
      }
      if (this.towerGroups[0] && this.towerGroups[0].rotation.z < 0.35) {
        this.towerGroups[0].rotation.z += dt * 0.3;
      }
      if (this.towerGroups[1] && this.towerGroups[1].rotation.z > -0.35) {
        this.towerGroups[1].rotation.z -= dt * 0.3;
      }
    }
  }
}
