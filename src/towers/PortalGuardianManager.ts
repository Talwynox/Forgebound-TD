import * as THREE from 'three';
import { Unit, UnitManager } from '../units/UnitManager';
import { VFXManager } from '../vfx/VFXManager';
import { audio } from '../engine/AudioSystem';

export interface GuardianStats {
  damage: number;
  range: number;
  fireRate: number; // Seconds between attacks
}

// Upgrade progression table - heavily buffed damage scaling & value per gold spent
export const GUARDIAN_DAMAGE_LEVELS: { level: number; damage: number; nextCost: number }[] = [
  { level: 1, damage: 50, nextCost: 25 },
  { level: 2, damage: 85, nextCost: 40 },
  { level: 3, damage: 135, nextCost: 60 },
  { level: 4, damage: 200, nextCost: 85 },
  { level: 5, damage: 280, nextCost: 115 },
  { level: 6, damage: 380, nextCost: 155 },
  { level: 7, damage: 505, nextCost: 205 },
  { level: 8, damage: 660, nextCost: 265 },
  { level: 9, damage: 850, nextCost: 340 },
  { level: 10, damage: 1100, nextCost: 0 } // Max level
];

export const GUARDIAN_RANGE_LEVELS: { level: number; range: number; nextCost: number }[] = [
  { level: 1, range: 13.0, nextCost: 20 },
  { level: 2, range: 15.2, nextCost: 35 },
  { level: 3, range: 17.8, nextCost: 55 },
  { level: 4, range: 20.6, nextCost: 80 },
  { level: 5, range: 23.8, nextCost: 110 },
  { level: 6, range: 27.2, nextCost: 150 },
  { level: 7, range: 31.0, nextCost: 200 },
  { level: 8, range: 35.0, nextCost: 260 },
  { level: 9, range: 39.5, nextCost: 330 },
  { level: 10, range: 45.0, nextCost: 0 } // Max level
];

export class PortalGuardian {
  public id: string;
  public name: string;
  public position: THREE.Vector3;
  public damageLevel: number = 1;
  public rangeLevel: number = 1;

  // Runtime combat stats
  public totalDamageDealt: number = 0;
  public totalKills: number = 0;
  public shotsFired: number = 0;
  public lastAttackTime: number = 0;

  // 3D Objects
  public group: THREE.Group;
  public ballistaMountGroup: THREE.Group;
  public bowLimbsGroup: THREE.Group;
  public boltGroup: THREE.Group;
  public runeWardRing: THREE.Mesh;
  public rangeIndicatorGroup: THREE.Group;
  public rangeFillMesh: THREE.Mesh;
  public rangeBorderMesh: THREE.Mesh;
  public colliderMesh: THREE.Mesh;
  private turretLight: THREE.PointLight;

  // Aiming & animation state
  private currentAimAngle: number = 0;
  private targetAimAngle: number = 0;
  private recoilTimer: number = 0;

  constructor(id: string, name: string, position: THREE.Vector3) {
    this.id = id;
    this.name = name;
    this.position = position.clone();

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    // --- Rich Medieval Fantasy Castle & Siege Materials ---
    const darkGranitePlinthMat = new THREE.MeshStandardMaterial({
      color: 0x332822, // Dark weathered foundation stone
      roughness: 0.85,
      metalness: 0.15
    });

    const castleStoneMat = new THREE.MeshStandardMaterial({
      color: 0x54473b, // Warm medieval castle ashlar stone
      roughness: 0.85,
      metalness: 0.1
    });

    const agedOakMat = new THREE.MeshStandardMaterial({
      color: 0x3e2312, // Seasoned dark oak timber beams & stock
      roughness: 0.75,
      metalness: 0.05
    });

    const forgedIronMat = new THREE.MeshStandardMaterial({
      color: 0x22262c, // Wrought black iron brackets, chains & winch
      roughness: 0.45,
      metalness: 0.8
    });

    const gildedBrassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Polished brass cogwheels, collars & fittings
      roughness: 0.3,
      metalness: 0.85
    });

    const knightShieldMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8, // Royal cobalt blue heraldic heater shield
      roughness: 0.4,
      metalness: 0.6
    });

    const shieldGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24, // Gold cross emblem on shield
      roughness: 0.3,
      metalness: 0.7
    });

    const steelBladeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // Forged steel broadhead sword & bolt tip
      roughness: 0.2,
      metalness: 0.9
    });

    const arcaneGlowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.8,
      roughness: 0.1,
      metalness: 0.2
    });

    const fireMat = new THREE.MeshStandardMaterial({
      color: 0xff7700,
      emissive: 0xff3700,
      emissiveIntensity: 1.6
    });

    const arrowSlitMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.2
    });

    // ==========================================================
    // 1. TIER 1: STEPPED MEDIEVAL FOUNDATION & CORNER BUTTRESSES
    // ==========================================================
    const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 2.1), darkGranitePlinthMat);
    basePlinth.position.y = 0.22;
    basePlinth.castShadow = true;
    basePlinth.receiveShadow = true;
    this.group.add(basePlinth);

    // 4 Angled Stone Corner Buttresses (Castle Barbican Redoubt)
    const buttressOffsets = [
      { x: 0.88, z: 0.88 },
      { x: 0.88, z: -0.88 },
      { x: -0.88, z: 0.88 },
      { x: -0.88, z: -0.88 }
    ];
    buttressOffsets.forEach(bo => {
      const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.9, 0.46), darkGranitePlinthMat);
      buttress.position.set(bo.x, 0.45, bo.z);
      buttress.rotation.y = Math.PI / 4;
      buttress.castShadow = true;
      buttress.receiveShadow = true;
      this.group.add(buttress);
    });

    // ==========================================================
    // 2. TIER 2: MEDIEVAL CASTLE STONE KEEP & HEAVY TIMBER BEAMS
    // ==========================================================
    const keep = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 1.5), castleStoneMat);
    keep.position.y = 1.35;
    keep.castShadow = true;
    keep.receiveShadow = true;
    this.group.add(keep);

    // 4 Vertical Heavy Oak Timber Corner Posts
    [
      { x: 0.72, z: 0.72 },
      { x: 0.72, z: -0.72 },
      { x: -0.72, z: 0.72 },
      { x: -0.72, z: -0.72 }
    ].forEach(co => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.85, 0.18), agedOakMat);
      post.position.set(co.x, 1.35, co.z);
      post.castShadow = true;
      this.group.add(post);
    });

    // Horizontal Iron-Reinforced Timber Cross-Braces
    [0.85, 1.75].forEach(yB => {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.1, 1.56), agedOakMat);
      brace.position.y = yB;
      this.group.add(brace);

      const ironStrap = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.04, 1.58), forgedIronMat);
      ironStrap.position.y = yB;
      this.group.add(ironStrap);
    });

    // Arched Castle Arrow-Slit Embrasures (Warm Torch Glow inside)
    [-0.35, 0.35].forEach(zOff => {
      const embrasure = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.12), arrowSlitMat);
      embrasure.position.set(0.76, 1.35, zOff);
      this.group.add(embrasure);
    });

    // ==========================================================
    // 3. KNIGHT'S HERALDIC HEATER SHIELD & CROSSED BROADSWORDS
    // ==========================================================
    const shieldGroup = new THREE.Group();
    shieldGroup.position.set(0.78, 1.45, 0);

    // Crossed Steel Broadswords behind shield
    [-0.55, 0.55].forEach(angle => {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.95, 0.07), steelBladeMat);
      blade.rotation.x = angle;
      blade.position.set(-0.01, 0, 0);
      shieldGroup.add(blade);

      const crossguard = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.22), gildedBrassMat);
      crossguard.rotation.x = angle;
      crossguard.position.set(-0.01, Math.cos(angle) * -0.28, Math.sin(angle) * 0.28);
      shieldGroup.add(crossguard);
    });

    // Royal Blue Heater Shield
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.65, 0.46), knightShieldMat);
    shield.position.set(0.02, 0, 0);
    shield.castShadow = true;
    shieldGroup.add(shield);

    // Gold Cross Emblem on Shield
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.09), shieldGoldMat);
    crossV.position.set(0.025, 0, 0);
    shieldGroup.add(crossV);

    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.34), shieldGoldMat);
    crossH.position.set(0.025, 0.06, 0);
    shieldGroup.add(crossH);

    this.group.add(shieldGroup);

    // ==========================================================
    // 4. CORBELLED MACHICOLATION & CRENELLATED BATTLEMENT PARAPET
    // ==========================================================
    const parapetDeck = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, 1.9), castleStoneMat);
    parapetDeck.position.y = 2.4;
    parapetDeck.castShadow = true;
    parapetDeck.receiveShadow = true;
    this.group.add(parapetDeck);

    // 8 Stone Crenellations around the perimeter
    const crenelOffsets = [
      { x: 0.88, z: 0.6, ry: 0 },
      { x: 0.88, z: -0.6, ry: 0 },
      { x: -0.88, z: 0.6, ry: 0 },
      { x: -0.88, z: -0.6, ry: 0 },
      { x: 0.6, z: 0.88, ry: Math.PI / 2 },
      { x: -0.6, z: 0.88, ry: Math.PI / 2 },
      { x: 0.6, z: -0.88, ry: Math.PI / 2 },
      { x: -0.6, z: -0.88, ry: Math.PI / 2 }
    ];
    crenelOffsets.forEach(co => {
      const crenel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.4), castleStoneMat);
      crenel.position.set(co.x, 2.68, co.z);
      crenel.rotation.y = co.ry;
      crenel.castShadow = true;
      this.group.add(crenel);
    });

    // Twin Iron Torch Braziers on the rear corners of the parapet
    [-0.72, 0.72].forEach(zB => {
      const brazierBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.35, 6), darkGranitePlinthMat);
      brazierBase.position.set(-0.72, 2.75, zB);
      this.group.add(brazierBase);

      const brazierBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 0.18, 8), forgedIronMat);
      brazierBowl.position.set(-0.72, 2.95, zB);
      this.group.add(brazierBowl);

      const fireOrb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12), fireMat);
      fireOrb.position.set(-0.72, 3.06, zB);
      this.group.add(fireOrb);

      const torchLight = new THREE.PointLight(0xf97316, 0.5, 5.0);
      torchLight.position.set(-0.72, 3.12, zB);
      this.group.add(torchLight);
    });

    // ==========================================================
    // 5. MEDIEVAL ARCANE SIEGE BALLISTA (Heavy Castle Scorpion)
    // ==========================================================
    this.ballistaMountGroup = new THREE.Group();
    this.ballistaMountGroup.position.set(0, 2.62, 0);

    // Heavy Circular Iron Turntable / Swivel Ring
    const turntable = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.76, 0.16, 16), forgedIronMat);
    turntable.position.y = 0.08;
    this.ballistaMountGroup.add(turntable);

    // Heavy Oak Ballista Stock / Chassis (oriented along +X towards the arena)
    const stock = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.22, 0.36), agedOakMat);
    stock.position.set(0.1, 0.26, 0);
    stock.castShadow = true;
    this.ballistaMountGroup.add(stock);

    // Iron reinforcement corner straps on the wooden chassis
    [-0.5, 0.1, 0.7].forEach(xP => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.38), forgedIronMat);
      strap.position.set(xP, 0.26, 0);
      this.ballistaMountGroup.add(strap);
    });

    // Launch Channel Trough Guide Rails
    const railL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.06), forgedIronMat);
    railL.position.set(0.15, 0.41, -0.12);
    this.ballistaMountGroup.add(railL);

    const railR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.06), forgedIronMat);
    railR.position.set(0.15, 0.41, 0.12);
    this.ballistaMountGroup.add(railR);

    // Side Winch Cog Wheels & Bronze Hand-Crank
    const cogL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), forgedIronMat);
    cogL.rotation.x = Math.PI / 2;
    cogL.position.set(-0.35, 0.26, -0.22);
    this.ballistaMountGroup.add(cogL);

    const crank = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.04), gildedBrassMat);
    crank.position.set(-0.35, 0.34, -0.26);
    this.ballistaMountGroup.add(crank);

    // --- Dynamic Recoil Group for Bow Limbs and Greatbolt ---
    this.bowLimbsGroup = new THREE.Group();
    this.bowLimbsGroup.position.set(0.7, 0.38, 0);

    // Crossbow Prod Mount Block
    const prodMount = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.42), forgedIronMat);
    prodMount.position.set(0, 0, 0);
    this.bowLimbsGroup.add(prodMount);

    // Left Recurve Bow Limb (angled back ~25° like a heavy siege scorpion)
    const limbL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 1.15, 8), agedOakMat);
    limbL.rotation.y = 0.42;
    limbL.rotation.x = -Math.PI / 2;
    limbL.position.set(-0.2, 0, -0.52);
    limbL.castShadow = true;
    this.bowLimbsGroup.add(limbL);

    // Iron Tip Cap Left
    const tipL = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), forgedIronMat);
    tipL.rotation.y = 0.42;
    tipL.rotation.x = -Math.PI / 2;
    tipL.position.set(-0.42, 0, -1.06);
    this.bowLimbsGroup.add(tipL);

    // Right Recurve Bow Limb
    const limbR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 1.15, 8), agedOakMat);
    limbR.rotation.y = -0.42;
    limbR.rotation.x = Math.PI / 2;
    limbR.position.set(-0.2, 0, 0.52);
    limbR.castShadow = true;
    this.bowLimbsGroup.add(limbR);

    // Iron Tip Cap Right
    const tipR = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), forgedIronMat);
    tipR.rotation.y = -0.42;
    tipR.rotation.x = Math.PI / 2;
    tipR.position.set(-0.42, 0, 1.06);
    this.bowLimbsGroup.add(tipR);

    // Taut Braided Sinew Bowstrings
    const stringL = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 4), gildedBrassMat);
    stringL.rotation.y = -0.75;
    stringL.rotation.x = -Math.PI / 2;
    stringL.position.set(-0.7, 0, -0.55);
    this.bowLimbsGroup.add(stringL);

    const stringR = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 4), gildedBrassMat);
    stringR.rotation.y = 0.75;
    stringR.rotation.x = Math.PI / 2;
    stringR.position.set(-0.7, 0, 0.55);
    this.bowLimbsGroup.add(stringR);

    // --- Enchanted Arcane Greatbolt (Spear loaded in the channel) ---
    this.boltGroup = new THREE.Group();
    this.boltGroup.position.set(0, 0.04, 0);

    // Ash wood bolt shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.6, 8), agedOakMat);
    shaft.rotation.z = -Math.PI / 2;
    shaft.position.set(0.2, 0, 0);
    this.boltGroup.add(shaft);

    // Forged Steel Broadhead Spearhead with Glowing Arcane Runes
    const spearhead = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 4), arcaneGlowMat);
    spearhead.rotation.z = -Math.PI / 2;
    spearhead.position.set(1.15, 0, 0);
    this.boltGroup.add(spearhead);

    // Golden arrow ferrule
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 8), gildedBrassMat);
    ferrule.rotation.z = -Math.PI / 2;
    ferrule.position.set(0.95, 0, 0);
    this.boltGroup.add(ferrule);

    // Rear Feathered Fletchings (3 fins in royal blue)
    for (let f = 0; f < 3; f++) {
      const angle = (f * Math.PI * 2) / 3;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.01, 0.08), knightShieldMat);
      fin.position.set(-0.5, Math.sin(angle) * 0.06, Math.cos(angle) * 0.06);
      fin.rotation.x = angle;
      this.boltGroup.add(fin);
    }

    this.bowLimbsGroup.add(this.boltGroup);
    this.ballistaMountGroup.add(this.bowLimbsGroup);

    // Rotating Arcane Blessing Rune Halo (Magic Weapon Enchantment)
    this.runeWardRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.035, 6, 24),
      arcaneGlowMat
    );
    this.runeWardRing.rotation.x = Math.PI / 2;
    this.runeWardRing.position.set(0, 0.65, 0);
    this.ballistaMountGroup.add(this.runeWardRing);

    // Glowing Arcane Point Light
    this.turretLight = new THREE.PointLight(0x38bdf8, 0.85, 6.5);
    this.turretLight.position.set(0.4, 0.75, 0);
    this.ballistaMountGroup.add(this.turretLight);

    this.group.add(this.ballistaMountGroup);

    // ==========================================================
    // 6. INVISIBLE INTERACTION COLLIDER FOR RAYCASTING
    // ==========================================================
    const colliderGeom = new THREE.BoxGeometry(2.4, 3.8, 2.4);
    const colliderMat = new THREE.MeshBasicMaterial({ visible: false });
    this.colliderMesh = new THREE.Mesh(colliderGeom, colliderMat);
    this.colliderMesh.position.y = 1.9;
    this.colliderMesh.userData = { guardian: this };
    this.group.add(this.colliderMesh);

    // ==========================================================
    // 7. ELEVATED GROUND RANGE INDICATOR (Fill + Glowing Border)
    // ==========================================================
    this.rangeIndicatorGroup = new THREE.Group();
    this.rangeIndicatorGroup.position.y = 0.20; // Elevated safely above arena floor (y = 0.10)

    const fillGeom = new THREE.CircleGeometry(1, 64);
    fillGeom.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide
    });
    this.rangeFillMesh = new THREE.Mesh(fillGeom, fillMat);
    this.rangeFillMesh.renderOrder = 30;
    const r = this.getRange();
    this.rangeFillMesh.scale.setScalar(r);
    this.rangeIndicatorGroup.add(this.rangeFillMesh);

    const ringGeom = new THREE.RingGeometry(Math.max(0.1, r - 0.22), r, 64);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.90,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -6,
      side: THREE.DoubleSide
    });
    this.rangeBorderMesh = new THREE.Mesh(ringGeom, ringMat);
    this.rangeBorderMesh.renderOrder = 31;
    this.rangeIndicatorGroup.add(this.rangeBorderMesh);

    this.rangeIndicatorGroup.visible = false;
    this.group.add(this.rangeIndicatorGroup);
  }

  public getDamage(): number {
    const idx = Math.min(this.damageLevel - 1, GUARDIAN_DAMAGE_LEVELS.length - 1);
    return GUARDIAN_DAMAGE_LEVELS[idx].damage;
  }

  public getNextDamage(): number | null {
    if (this.damageLevel >= GUARDIAN_DAMAGE_LEVELS.length) return null;
    return GUARDIAN_DAMAGE_LEVELS[this.damageLevel].damage;
  }

  public getDamageUpgradeCost(): number {
    const idx = Math.min(this.damageLevel - 1, GUARDIAN_DAMAGE_LEVELS.length - 1);
    return GUARDIAN_DAMAGE_LEVELS[idx].nextCost;
  }

  public getRange(): number {
    const idx = Math.min(this.rangeLevel - 1, GUARDIAN_RANGE_LEVELS.length - 1);
    return GUARDIAN_RANGE_LEVELS[idx].range;
  }

  public getNextRange(): number | null {
    if (this.rangeLevel >= GUARDIAN_RANGE_LEVELS.length) return null;
    return GUARDIAN_RANGE_LEVELS[this.rangeLevel].range;
  }

  public getRangeUpgradeCost(): number {
    const idx = Math.min(this.rangeLevel - 1, GUARDIAN_RANGE_LEVELS.length - 1);
    return GUARDIAN_RANGE_LEVELS[idx].nextCost;
  }

  public upgradeDamage(): boolean {
    if (this.damageLevel >= GUARDIAN_DAMAGE_LEVELS.length) return false;
    this.damageLevel++;
    return true;
  }

  public upgradeRange(): boolean {
    if (this.rangeLevel >= GUARDIAN_RANGE_LEVELS.length) return false;
    this.rangeLevel++;
    this.rebuildRangeIndicator();
    return true;
  }

  /** Multiplayer client: mirror the host's authoritative upgrade levels & stats. */
  public applyNetworkState(damageLevel: number, rangeLevel: number, totalDamageDealt: number, totalKills: number, shotsFired: number) {
    this.damageLevel = damageLevel;
    if (this.rangeLevel !== rangeLevel) {
      this.rangeLevel = rangeLevel;
      this.rebuildRangeIndicator();
    }
    this.totalDamageDealt = totalDamageDealt;
    this.totalKills = totalKills;
    this.shotsFired = shotsFired;
  }

  private rebuildRangeIndicator() {
    const r = this.getRange();
    this.rangeFillMesh.scale.setScalar(r);

    this.rangeBorderMesh.geometry.dispose();
    const ringGeom = new THREE.RingGeometry(Math.max(0.1, r - 0.22), r, 64);
    ringGeom.rotateX(-Math.PI / 2);
    this.rangeBorderMesh.geometry = ringGeom;
  }

  public setSelected(selected: boolean) {
    this.rangeIndicatorGroup.visible = selected;
  }

  public reset() {
    this.damageLevel = 1;
    this.rangeLevel = 1;
    this.totalDamageDealt = 0;
    this.totalKills = 0;
    this.shotsFired = 0;
    this.lastAttackTime = 0;
    this.rebuildRangeIndicator();
    this.setSelected(false);
  }

  public updateAnimation(dt: number, time: number, targetUnit?: Unit | null) {
    // Sentry scanning or tracking combat enemy
    if (targetUnit && !targetUnit.isDead && !targetUnit.isDying) {
      // Calculate angle from guardian towards enemy in world space
      const angle = Math.atan2(targetUnit.worldPos.z - this.position.z, targetUnit.worldPos.x - this.position.x);
      this.targetAimAngle = -angle;
    } else {
      // Gentle sentry scanning back and forth across arena (+X direction)
      const offset = this.id === 'guardian-north' ? 0 : Math.PI * 0.7;
      this.targetAimAngle = Math.sin(time * 0.0014 + offset) * 0.35;
    }

    // Smooth ballista carriage traverse interpolation
    let diff = this.targetAimAngle - this.currentAimAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.currentAimAngle += diff * Math.min(1.0, dt * 4.0);
    this.ballistaMountGroup.rotation.y = this.currentAimAngle;

    // Recoil spring recovery animation (bow limbs snap back, then carriage resets)
    if (this.recoilTimer > 0) {
      this.recoilTimer -= dt;
      const progress = this.recoilTimer / 0.18;
      this.bowLimbsGroup.position.x = 0.7 - Math.sin(progress * Math.PI) * 0.28;
    } else {
      this.bowLimbsGroup.position.x = 0.7;
    }

    // Rotating Arcane Rune Ward Halo
    if (this.runeWardRing) {
      this.runeWardRing.rotation.z += dt * 1.6;
    }
  }

  public fireAt(target: Unit, vfx: VFXManager, unitManager: UnitManager, onKillEnemy: (bounty: number, enemyClass?: any, isBoss?: boolean) => void) {
    this.shotsFired++;
    this.recoilTimer = 0.18;

    // Immediately snap ballista carriage to aim at target
    const angle = Math.atan2(target.worldPos.z - this.position.z, target.worldPos.x - this.position.x);
    this.targetAimAngle = -angle;
    this.currentAimAngle = -angle;
    this.ballistaMountGroup.rotation.y = this.currentAimAngle;

    // Origin: Tip of the spearhead at the front of the ballista
    const aimVec = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const originPos = new THREE.Vector3(
      this.position.x + aimVec.x * 1.8,
      3.1,
      this.position.z + aimVec.z * 1.8
    );
    const targetHitPos = target.worldPos.clone().add(new THREE.Vector3(0, 0.6, 0));

    // Heavy siege ballista release audio
    audio.playGuardianShot();

    // High-energy mystic greatbolt projectile streak
    vfx.spawnBeam(originPos, targetHitPos, 0x38bdf8, 0.2);

    // Muzzle blast particles at the enchanted arrowhead
    vfx.spawnBurstParticles(originPos, 0x38bdf8, 12);

    // Apply combat damage
    const dealt = unitManager.damageUnit(target, this.getDamage(), onKillEnemy);
    this.totalDamageDealt += dealt;

    if (target.isDead || target.isDying) {
      this.totalKills++;
      vfx.spawnBurstParticles(targetHitPos, 0xfacc15, 18);
    }
  }
}

export class PortalGuardianManager {
  private scene: THREE.Scene;
  private vfx: VFXManager;
  private unitManager: UnitManager;

  public guardians: PortalGuardian[] = [];
  public selectedGuardian: PortalGuardian | null = null;
  public focusTarget: Unit | null = null;
  public fireCooldown: number = 1.0; // Firing cadence (1.0s)

  constructor(scene: THREE.Scene, vfx: VFXManager, unitManager: UnitManager) {
    this.scene = scene;
    this.vfx = vfx;
    this.unitManager = unitManager;

    // Stationed flanking the Arrival Portal at X = 2.2, Z = +4.2 (North) and Z = -4.2 (South)
    const northGuardian = new PortalGuardian(
      'guardian-north',
      'North Ballista Bastion',
      new THREE.Vector3(2.2, 0, 4.2)
    );

    const southGuardian = new PortalGuardian(
      'guardian-south',
      'South Ballista Bastion',
      new THREE.Vector3(2.2, 0, -4.2)
    );

    this.guardians.push(northGuardian, southGuardian);

    for (const g of this.guardians) {
      this.scene.add(g.group);
    }
  }

  public setFocusTarget(target: Unit | null) {
    this.focusTarget = target;
  }

  public getGuardianMeshes(): THREE.Object3D[] {
    return this.guardians.map(g => g.colliderMesh);
  }

  public checkClick(raycaster: THREE.Raycaster): PortalGuardian | null {
    const colliders = this.getGuardianMeshes();
    const intersects = raycaster.intersectObjects(colliders, false);
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      return (hit.userData?.guardian as PortalGuardian) || null;
    }
    return null;
  }

  public select(guardian: PortalGuardian | null) {
    this.selectedGuardian = guardian;
    for (const g of this.guardians) {
      g.setSelected(g === guardian);
    }
  }

  public deselect() {
    this.select(null);
  }

  public getGuardian(id: string): PortalGuardian | undefined {
    return this.guardians.find(g => g.id === id);
  }

  public getSelectedGuardian(): PortalGuardian | null {
    return this.selectedGuardian;
  }

  public resetAll() {
    this.deselect();
    this.focusTarget = null;
    for (const g of this.guardians) {
      g.reset();
    }
  }

  /**
   * @param allowFiring false on multiplayer clients: ballistae only track targets, the host resolves shots.
   */
  public update(
    dt: number,
    time: number,
    onKillEnemy: (bounty: number, enemyClass?: any, isBoss?: boolean) => void,
    inCombat: boolean,
    allowFiring: boolean = true
  ) {
    // Validate focus target
    if (this.focusTarget && (this.focusTarget.isDead || this.focusTarget.isDying || !this.focusTarget.inCombat)) {
      this.focusTarget = null;
    }

    // Collect active combat enemies (only when in combat)
    const activeCombatEnemies = inCombat
      ? this.unitManager.units.filter(u => !u.isFriendly && !u.isDead && !u.isDying && u.inCombat)
      : [];

    // 1. Update Ballista tracking & animations
    for (const guardian of this.guardians) {
      let trackedTarget: Unit | null = null;
      if (this.focusTarget && guardian.position.distanceTo(this.focusTarget.worldPos) <= guardian.getRange()) {
        trackedTarget = this.focusTarget;
      } else if (activeCombatEnemies.length > 0) {
        let minDist = guardian.getRange();
        for (const e of activeCombatEnemies) {
          const d = guardian.position.distanceTo(e.worldPos);
          if (d <= minDist) {
            minDist = d;
            trackedTarget = e;
          }
        }
      }
      guardian.updateAnimation(dt, time, trackedTarget);
    }

    // 2. Targeting & Firing (ONLY after the fight has started in Arena Clash!)
    if (!allowFiring || !inCombat || activeCombatEnemies.length === 0) return;

    for (const guardian of this.guardians) {
      const elapsed = (time - guardian.lastAttackTime) / 1000;
      if (elapsed < this.fireCooldown) continue;

      const range = guardian.getRange();

      let target: Unit | null = null;

      // FOCUS FIRE PRIORITY: If an enemy has been designated as priority target by the player, shoot it!
      if (this.focusTarget && guardian.position.distanceTo(this.focusTarget.worldPos) <= range) {
        target = this.focusTarget;
      } else {
        // Filter enemies within range
        const inRangeEnemies = activeCombatEnemies.filter(
          e => guardian.position.distanceTo(e.worldPos) <= range
        );

        if (inRangeEnemies.length === 0) continue;

        // Smart target priority:
        // 1. Highest priority: Enemies closest to breach (closest to X = 1.8 arrival pad)
        // 2. Secondary: Lowest current HP to eliminate threats quickly
        inRangeEnemies.sort((a, b) => {
          const distA = Math.abs(a.worldPos.x - 1.8);
          const distB = Math.abs(b.worldPos.x - 1.8);
          if (Math.abs(distA - distB) > 1.5) {
            return distA - distB; // Closest to portal breach first
          }
          return a.currentHp - b.currentHp; // Lowest HP first
        });

        target = inRangeEnemies[0];
      }

      // Fire Greatbolt!
      guardian.lastAttackTime = time;
      guardian.fireAt(target, this.vfx, this.unitManager, onKillEnemy);
    }
  }
}
