/**
 * TowerData: Definitions, stats, costs, and branching upgrade data for all Forgebound TD towers.
 */

export enum TowerType {
  SHRINE = 'SHRINE',
  FORGE = 'FORGE',
  OBELISK = 'OBELISK',
  AURA = 'AURA',
  FROST = 'FROST',
  RULEBREAKER = 'RULEBREAKER',
  GOLD = 'GOLD',
  EVOLUTION = 'EVOLUTION'
}

export enum UpgradeBranch {
  NONE = 'NONE',
  BRANCH_A = 'BRANCH_A', // Standard / Focused
  BRANCH_B = 'BRANCH_B', // Slow Stacking / Synergistic
  BRANCH_C = 'BRANCH_C'  // Third Specialization (e.g. Mage Sanctum)
}

export interface TowerUpgradeDef {
  name: string;
  cost: number;
  description: string;
  badge: string; // e.g., 'Burst Heal' or 'Slow Stacking'
  range: number;
  rate: number; // Attack/cast interval in seconds
  // Specific modifiers
  healAmount?: number;
  armorAmount?: number;
  attackAmount?: number;
  slowPercent?: number;
  slowDuration?: number;
  auraSpeedBonus?: number; // e.g. 0.50 for +50% cast speed
  fixedHp?: number;
  goldPerHit?: number;
  roundInterestPercent?: number;
  roundFlatGold?: number;
  roundInterestCap?: number; // Max interest paid per round, so banked gold can't compound without limit
  // Slow Stacking bonuses (applied at end of round)
  stackingHpPerRound?: number;
  stackingArmorPerRound?: number;
  stackingAttackPerRound?: number;
  unlockTier3Evolution?: boolean;
  grantUnitPassive?: string;
}

export interface TowerDef {
  type: TowerType;
  name: string;
  cost: number;
  description: string;
  color: number;
  accentColor: number;
  range: number;
  rate: number; // Base attack/cast interval in seconds
  // Base effects
  healAmount?: number;
  armorAmount?: number;
  attackAmount?: number;
  slowPercent?: number;
  slowDuration?: number;
  auraSpeedBonus?: number;
  fixedHp?: number;
  goldPerHit?: number;
  roundInterestPercent?: number;
  // Branching Upgrades (3 ranks per branch)
  branchA: TowerUpgradeDef[];
  branchB: TowerUpgradeDef[];
  branchC?: TowerUpgradeDef[];
}

export interface EvoAbilityTier {
  level: number;
  cost: number;
  name: string;
  description: string;
  bonus?: number; // Armor aura bonus, damage aura bonus, fireball radius, ramp per hit, or general bonus
  chance?: number; // Multishot chance or stun chance
  multiplier?: number; // Fireball damage multiplier, thorns multiplier, or burn multiplier
  targets?: number; // Multishot target count
  duration?: number; // Stun duration or debuff duration
  secondaryBonus?: number; // Flat damage reduction or secondary stat
}

export const SOLDIER_ABILITIES = {
  armorAura: [
    { level: 1, cost: 50, name: 'Armor Aura I', description: 'Radiates +5 Armor to all surrounding allies in combat.', bonus: 5 },
    { level: 2, cost: 70, name: 'Armor Aura II', description: 'Radiates +11 Armor to all surrounding allies in combat.', bonus: 11 },
    { level: 3, cost: 95, name: 'Armor Aura III', description: 'Radiates +18 Armor to all surrounding allies in combat.', bonus: 18 },
    { level: 4, cost: 125, name: 'Armor Aura IV', description: 'Radiates +27 Armor to all surrounding allies in combat.', bonus: 27 },
    { level: 5, cost: 160, name: 'Armor Aura V', description: 'Radiates +37 Armor to all surrounding allies in combat.', bonus: 37 },
    { level: 6, cost: 200, name: 'Armor Aura VI', description: 'Radiates +49 Armor to all surrounding allies in combat.', bonus: 49 },
    { level: 7, cost: 250, name: 'Armor Aura VII', description: 'Radiates +63 Armor to all surrounding allies in combat.', bonus: 63 },
    { level: 8, cost: 310, name: 'Armor Aura VIII', description: 'Radiates +80 Armor to all surrounding allies in combat.', bonus: 80 },
    { level: 9, cost: 380, name: 'Armor Aura IX', description: 'Radiates +99 Armor to all surrounding allies in combat.', bonus: 99 },
    { level: 10, cost: 460, name: 'Armor Aura X - Aegis of the Sun', description: 'Radiates +120 Armor to all surrounding allies in combat!', bonus: 120 }
  ] as EvoAbilityTier[],
  relentless: [
    { level: 1, cost: 50, name: 'Relentless Assault I', description: 'Each consecutive hit on the same target deals +1% more damage (stacks; resets on a new target).', bonus: 0.01 },
    { level: 2, cost: 70, name: 'Relentless Assault II', description: 'Each consecutive hit on the same target deals +2% more damage (stacks; resets on a new target).', bonus: 0.02 },
    { level: 3, cost: 95, name: 'Relentless Assault III', description: 'Each consecutive hit on the same target deals +3.25% more damage (stacks; resets on a new target).', bonus: 0.0325 },
    { level: 4, cost: 125, name: 'Relentless Assault IV', description: 'Each consecutive hit on the same target deals +4.75% more damage (stacks; resets on a new target).', bonus: 0.0475 },
    { level: 5, cost: 160, name: 'Relentless Assault V', description: 'Each consecutive hit on the same target deals +6.5% more damage (stacks; resets on a new target).', bonus: 0.065 },
    { level: 6, cost: 200, name: 'Relentless Assault VI', description: 'Each consecutive hit on the same target deals +8.5% more damage (stacks; resets on a new target).', bonus: 0.085 },
    { level: 7, cost: 250, name: 'Relentless Assault VII', description: 'Each consecutive hit on the same target deals +10.75% more damage (stacks; resets on a new target).', bonus: 0.1075 },
    { level: 8, cost: 310, name: 'Relentless Assault VIII', description: 'Each consecutive hit on the same target deals +13.25% more damage (stacks; resets on a new target).', bonus: 0.1325 },
    { level: 9, cost: 380, name: 'Relentless Assault IX', description: 'Each consecutive hit on the same target deals +16.25% more damage (stacks; resets on a new target).', bonus: 0.1625 },
    { level: 10, cost: 460, name: 'Relentless Assault X - Guillotine', description: 'Each consecutive hit on the same target deals +19.75% more damage (stacks; resets on a new target)!', bonus: 0.1975 }
  ] as EvoAbilityTier[],
  lifeRegen: [
    { level: 1, cost: 50, name: 'Iron Vigor I', description: 'Passively regenerates +8 HP/sec in combat.', bonus: 8 },
    { level: 2, cost: 70, name: 'Iron Vigor II', description: 'Passively regenerates +17 HP/sec in combat.', bonus: 17 },
    { level: 3, cost: 95, name: 'Iron Vigor III', description: 'Passively regenerates +29 HP/sec in combat.', bonus: 29 },
    { level: 4, cost: 125, name: 'Iron Vigor IV', description: 'Passively regenerates +44 HP/sec in combat.', bonus: 44 },
    { level: 5, cost: 160, name: 'Iron Vigor V', description: 'Passively regenerates +62 HP/sec in combat.', bonus: 62 },
    { level: 6, cost: 200, name: 'Iron Vigor VI', description: 'Passively regenerates +82 HP/sec in combat.', bonus: 82 },
    { level: 7, cost: 250, name: 'Iron Vigor VII', description: 'Passively regenerates +106 HP/sec in combat.', bonus: 106 },
    { level: 8, cost: 310, name: 'Iron Vigor VIII', description: 'Passively regenerates +133 HP/sec in combat.', bonus: 133 },
    { level: 9, cost: 380, name: 'Iron Vigor IX', description: 'Passively regenerates +165 HP/sec in combat.', bonus: 165 },
    { level: 10, cost: 460, name: 'Iron Vigor X - Undying Resolve', description: 'Passively regenerates +200 HP/sec in combat!', bonus: 200 }
  ] as EvoAbilityTier[],
  thorns: [
    { level: 1, cost: 50, name: 'Spiked Bulwark I', description: 'Reduces incoming damage by 2 and reflects 4% melee damage back.', multiplier: 0.04, secondaryBonus: 2 },
    { level: 2, cost: 70, name: 'Spiked Bulwark II', description: 'Reduces incoming damage by 4 and reflects 9% melee damage back.', multiplier: 0.09, secondaryBonus: 4 },
    { level: 3, cost: 95, name: 'Spiked Bulwark III', description: 'Reduces incoming damage by 6 and reflects 15% melee damage back.', multiplier: 0.15, secondaryBonus: 6 },
    { level: 4, cost: 125, name: 'Spiked Bulwark IV', description: 'Reduces incoming damage by 8 and reflects 22% melee damage back.', multiplier: 0.22, secondaryBonus: 8 },
    { level: 5, cost: 160, name: 'Spiked Bulwark V', description: 'Reduces incoming damage by 10 and reflects 30% melee damage back.', multiplier: 0.30, secondaryBonus: 10 },
    { level: 6, cost: 200, name: 'Spiked Bulwark VI', description: 'Reduces incoming damage by 12 and reflects 39% melee damage back.', multiplier: 0.39, secondaryBonus: 12 },
    { level: 7, cost: 250, name: 'Spiked Bulwark VII', description: 'Reduces incoming damage by 14 and reflects 50% melee damage back.', multiplier: 0.50, secondaryBonus: 14 },
    { level: 8, cost: 310, name: 'Spiked Bulwark VIII', description: 'Reduces incoming damage by 16 and reflects 63% melee damage back.', multiplier: 0.63, secondaryBonus: 16 },
    { level: 9, cost: 380, name: 'Spiked Bulwark IX', description: 'Reduces incoming damage by 18 and reflects 78% melee damage back.', multiplier: 0.78, secondaryBonus: 18 },
    { level: 10, cost: 460, name: 'Spiked Bulwark X - Dreadnought Carapace', description: 'Reduces incoming damage by 20 and reflects 95% melee damage back!', multiplier: 0.95, secondaryBonus: 20 }
  ] as EvoAbilityTier[]
};

export const ARCHER_ABILITIES = {
  multishot: [
    { level: 1, cost: 50, name: 'Multishot I', description: '11% chance to fire arrows at 2 targets simultaneously.', chance: 0.11, targets: 2 },
    { level: 2, cost: 70, name: 'Multishot II', description: '26% chance to fire arrows at 2 targets simultaneously.', chance: 0.26, targets: 2 },
    { level: 3, cost: 95, name: 'Multishot III', description: '44% chance to fire arrows at 2 targets simultaneously.', chance: 0.44, targets: 2 },
    { level: 4, cost: 125, name: 'Multishot IV', description: '66% chance to fire arrows at 2 targets simultaneously.', chance: 0.66, targets: 2 },
    { level: 5, cost: 160, name: 'Multishot V', description: '46% chance to fire arrows at 3 targets simultaneously.', chance: 0.46, targets: 3 },
    { level: 6, cost: 200, name: 'Multishot VI', description: '61% chance to fire arrows at 3 targets simultaneously.', chance: 0.61, targets: 3 },
    { level: 7, cost: 250, name: 'Multishot VII', description: '79% chance to fire arrows at 3 targets simultaneously.', chance: 0.79, targets: 3 },
    { level: 8, cost: 310, name: 'Multishot VIII', description: '67% chance to fire arrows at 4 targets simultaneously.', chance: 0.67, targets: 4 },
    { level: 9, cost: 380, name: 'Multishot IX', description: '83% chance to fire arrows at 4 targets simultaneously.', chance: 0.83, targets: 4 },
    { level: 10, cost: 460, name: 'Multishot X - Arrow Tempest', description: '75% chance to fire arrows at 5 targets simultaneously!', chance: 0.75, targets: 5 }
  ] as EvoAbilityTier[],
  damageAura: [
    { level: 1, cost: 50, name: 'Damage Aura I', description: 'Radiates +6 Attack to all surrounding allies in combat.', bonus: 6 },
    { level: 2, cost: 70, name: 'Damage Aura II', description: 'Radiates +13 Attack to all surrounding allies in combat.', bonus: 13 },
    { level: 3, cost: 95, name: 'Damage Aura III', description: 'Radiates +21 Attack to all surrounding allies in combat.', bonus: 21 },
    { level: 4, cost: 125, name: 'Damage Aura IV', description: 'Radiates +31 Attack to all surrounding allies in combat.', bonus: 31 },
    { level: 5, cost: 160, name: 'Damage Aura V', description: 'Radiates +43 Attack to all surrounding allies in combat.', bonus: 43 },
    { level: 6, cost: 200, name: 'Damage Aura VI', description: 'Radiates +57 Attack to all surrounding allies in combat.', bonus: 57 },
    { level: 7, cost: 250, name: 'Damage Aura VII', description: 'Radiates +74 Attack to all surrounding allies in combat.', bonus: 74 },
    { level: 8, cost: 310, name: 'Damage Aura VIII', description: 'Radiates +93 Attack to all surrounding allies in combat.', bonus: 93 },
    { level: 9, cost: 380, name: 'Damage Aura IX', description: 'Radiates +115 Attack to all surrounding allies in combat.', bonus: 115 },
    { level: 10, cost: 460, name: 'Damage Aura X - Sovereign Might', description: 'Radiates +140 Attack to all surrounding allies in combat!', bonus: 140 }
  ] as EvoAbilityTier[],
  armorShred: [
    { level: 1, cost: 50, name: 'Sundering Shot I', description: 'Attacks shred 3 enemy Armor for 4.0s (benefits all allies!).', bonus: 3, duration: 4.0 },
    { level: 2, cost: 70, name: 'Sundering Shot II', description: 'Attacks shred 6 enemy Armor for 4.0s.', bonus: 6, duration: 4.0 },
    { level: 3, cost: 95, name: 'Sundering Shot III', description: 'Attacks shred 9 enemy Armor for 4.0s.', bonus: 9, duration: 4.0 },
    { level: 4, cost: 125, name: 'Sundering Shot IV', description: 'Attacks shred 12 enemy Armor for 4.0s.', bonus: 12, duration: 4.0 },
    { level: 5, cost: 160, name: 'Sundering Shot V', description: 'Attacks shred 15 enemy Armor for 4.0s.', bonus: 15, duration: 4.0 },
    { level: 6, cost: 200, name: 'Sundering Shot VI', description: 'Attacks shred 18 enemy Armor for 4.0s.', bonus: 18, duration: 4.0 },
    { level: 7, cost: 250, name: 'Sundering Shot VII', description: 'Attacks shred 21 enemy Armor for 4.0s.', bonus: 21, duration: 4.0 },
    { level: 8, cost: 310, name: 'Sundering Shot VIII', description: 'Attacks shred 24 enemy Armor for 4.0s.', bonus: 24, duration: 4.0 },
    { level: 9, cost: 380, name: 'Sundering Shot IX', description: 'Attacks shred 27 enemy Armor for 4.0s.', bonus: 27, duration: 4.0 },
    { level: 10, cost: 460, name: 'Sundering Shot X - Armor Breaker', description: 'Attacks shred 30 enemy Armor for 4.0s!', bonus: 30, duration: 4.0 }
  ] as EvoAbilityTier[],
  rapidQuiver: [
    { level: 1, cost: 50, name: 'Rapid Quiver I', description: 'Increases attack speed by +4% (0.82s attack rate).', bonus: 0.04 },
    { level: 2, cost: 70, name: 'Rapid Quiver II', description: 'Increases attack speed by +9% (0.78s attack rate).', bonus: 0.09 },
    { level: 3, cost: 95, name: 'Rapid Quiver III', description: 'Increases attack speed by +15% (0.74s attack rate).', bonus: 0.15 },
    { level: 4, cost: 125, name: 'Rapid Quiver IV', description: 'Increases attack speed by +22% (0.70s attack rate).', bonus: 0.22 },
    { level: 5, cost: 160, name: 'Rapid Quiver V', description: 'Increases attack speed by +30% (0.65s attack rate).', bonus: 0.30 },
    { level: 6, cost: 200, name: 'Rapid Quiver VI', description: 'Increases attack speed by +39% (0.61s attack rate).', bonus: 0.39 },
    { level: 7, cost: 250, name: 'Rapid Quiver VII', description: 'Increases attack speed by +49% (0.57s attack rate).', bonus: 0.49 },
    { level: 8, cost: 310, name: 'Rapid Quiver VIII', description: 'Increases attack speed by +61% (0.53s attack rate).', bonus: 0.61 },
    { level: 9, cost: 380, name: 'Rapid Quiver IX', description: 'Increases attack speed by +74% (0.49s attack rate).', bonus: 0.74 },
    { level: 10, cost: 460, name: 'Rapid Quiver X - Windrunner Flurry', description: 'Increases attack speed by +89% (0.45s attack rate)!', bonus: 0.89 }
  ] as EvoAbilityTier[]
};

export const MAGE_ABILITIES = {
  manaGain: [
    { level: 1, cost: 50, name: 'Arcane Siphon I', description: 'Generates +28 Mana per attack (Fireball every 3.6 attacks).', bonus: 28 },
    { level: 2, cost: 70, name: 'Arcane Siphon II', description: 'Generates +32 Mana per attack (Fireball every 3.1 attacks).', bonus: 32 },
    { level: 3, cost: 95, name: 'Arcane Siphon III', description: 'Generates +37 Mana per attack (Fireball every 2.7 attacks).', bonus: 37 },
    { level: 4, cost: 125, name: 'Arcane Siphon IV', description: 'Generates +43 Mana per attack (Fireball every 2.3 attacks).', bonus: 43 },
    { level: 5, cost: 160, name: 'Arcane Siphon V', description: 'Generates +50 Mana per attack (Fireball every 2.0 attacks).', bonus: 50 },
    { level: 6, cost: 200, name: 'Arcane Siphon VI', description: 'Generates +58 Mana per attack (Fireball every 1.7 attacks).', bonus: 58 },
    { level: 7, cost: 250, name: 'Arcane Siphon VII', description: 'Generates +67 Mana per attack (Fireball every 1.5 attacks).', bonus: 67 },
    { level: 8, cost: 310, name: 'Arcane Siphon VIII', description: 'Generates +77 Mana per attack (Fireball every 1.3 attacks).', bonus: 77 },
    { level: 9, cost: 380, name: 'Arcane Siphon IX', description: 'Generates +88 Mana per attack (Fireball every 1.1 attacks).', bonus: 88 },
    { level: 10, cost: 460, name: 'Arcane Siphon X - Leyline Font', description: 'Generates +100 Mana per attack (Fireball every single attack!).', bonus: 100 }
  ] as EvoAbilityTier[],
  fireball: [
    { level: 1, cost: 50, name: 'Mega Fireball I', description: 'Full mana casts AoE Fireball dealing 2.8x Attack damage across a 2.5m radius.', multiplier: 2.8, bonus: 2.5 },
    { level: 2, cost: 70, name: 'Mega Fireball II', description: 'Full mana casts AoE Fireball dealing 3.3x Attack damage across a 2.75m radius.', multiplier: 3.3, bonus: 2.75 },
    { level: 3, cost: 95, name: 'Mega Fireball III', description: 'Full mana casts AoE Fireball dealing 3.9x Attack damage across a 3.0m radius.', multiplier: 3.9, bonus: 3.0 },
    { level: 4, cost: 125, name: 'Mega Fireball IV', description: 'Full mana casts AoE Fireball dealing 4.6x Attack damage across a 3.25m radius.', multiplier: 4.6, bonus: 3.25 },
    { level: 5, cost: 160, name: 'Mega Fireball V', description: 'Full mana casts AoE Fireball dealing 5.4x Attack damage across a 3.5m radius.', multiplier: 5.4, bonus: 3.5 },
    { level: 6, cost: 200, name: 'Mega Fireball VI', description: 'Full mana casts AoE Fireball dealing 6.3x Attack damage across a 3.75m radius.', multiplier: 6.3, bonus: 3.75 },
    { level: 7, cost: 250, name: 'Mega Fireball VII', description: 'Full mana casts AoE Fireball dealing 7.3x Attack damage across a 4.0m radius.', multiplier: 7.3, bonus: 4.0 },
    { level: 8, cost: 310, name: 'Mega Fireball VIII', description: 'Full mana casts AoE Fireball dealing 8.3x Attack damage across a 4.25m radius.', multiplier: 8.3, bonus: 4.25 },
    { level: 9, cost: 380, name: 'Mega Fireball IX', description: 'Full mana casts AoE Fireball dealing 9.4x Attack damage across a 4.5m radius.', multiplier: 9.4, bonus: 4.5 },
    { level: 10, cost: 460, name: 'Mega Fireball X - Hellfire Nova', description: 'Full mana casts AoE Fireball dealing 10.5x Attack damage across a 4.75m radius!', multiplier: 10.5, bonus: 4.75 }
  ] as EvoAbilityTier[],
  stun: [
    { level: 1, cost: 50, name: 'Paralyzing Arc I', description: '5% chance to stun target for 0.7s with a crackling lightning jolt.', chance: 0.05, duration: 0.7 },
    { level: 2, cost: 70, name: 'Paralyzing Arc II', description: '9% chance to stun target for 0.9s.', chance: 0.09, duration: 0.9 },
    { level: 3, cost: 95, name: 'Paralyzing Arc III', description: '13% chance to stun target for 1.1s.', chance: 0.13, duration: 1.1 },
    { level: 4, cost: 125, name: 'Paralyzing Arc IV', description: '17% chance to stun target for 1.3s.', chance: 0.17, duration: 1.3 },
    { level: 5, cost: 160, name: 'Paralyzing Arc V', description: '21% chance to stun target for 1.5s.', chance: 0.21, duration: 1.5 },
    { level: 6, cost: 200, name: 'Paralyzing Arc VI', description: '25% chance to stun target for 1.7s.', chance: 0.25, duration: 1.7 },
    { level: 7, cost: 250, name: 'Paralyzing Arc VII', description: '29% chance to stun target for 1.9s.', chance: 0.29, duration: 1.9 },
    { level: 8, cost: 310, name: 'Paralyzing Arc VIII', description: '33% chance to stun target for 2.1s.', chance: 0.33, duration: 2.1 },
    { level: 9, cost: 380, name: 'Paralyzing Arc IX', description: '37% chance to stun target for 2.3s.', chance: 0.37, duration: 2.3 },
    { level: 10, cost: 460, name: 'Paralyzing Arc X - Temporal Stasis', description: '41% chance to stun target for 2.5s (halts movement, attacks & boss abilities)!', chance: 0.41, duration: 2.5 }
  ] as EvoAbilityTier[],
  burn: [
    { level: 1, cost: 50, name: 'Molten Pyre I', description: 'Attacks & fireballs ignite enemies for 6% Attack power/sec over 3.0s.', multiplier: 0.06, duration: 3.0 },
    { level: 2, cost: 70, name: 'Molten Pyre II', description: 'Attacks ignite enemies for 14% Attack power/sec over 3.0s.', multiplier: 0.14, duration: 3.0 },
    { level: 3, cost: 95, name: 'Molten Pyre III', description: 'Attacks ignite enemies for 24% Attack power/sec over 3.0s.', multiplier: 0.24, duration: 3.0 },
    { level: 4, cost: 125, name: 'Molten Pyre IV', description: 'Attacks ignite enemies for 36% Attack power/sec over 3.0s.', multiplier: 0.36, duration: 3.0 },
    { level: 5, cost: 160, name: 'Molten Pyre V', description: 'Attacks ignite enemies for 49% Attack power/sec over 3.0s.', multiplier: 0.49, duration: 3.0 },
    { level: 6, cost: 200, name: 'Molten Pyre VI', description: 'Attacks ignite enemies for 65% Attack power/sec over 3.0s.', multiplier: 0.65, duration: 3.0 },
    { level: 7, cost: 250, name: 'Molten Pyre VII', description: 'Attacks ignite enemies for 84% Attack power/sec over 3.0s.', multiplier: 0.84, duration: 3.0 },
    { level: 8, cost: 310, name: 'Molten Pyre VIII', description: 'Attacks ignite enemies for 107% Attack power/sec over 3.0s.', multiplier: 1.07, duration: 3.0 },
    { level: 9, cost: 380, name: 'Molten Pyre IX', description: 'Attacks ignite enemies for 132% Attack power/sec over 3.0s.', multiplier: 1.32, duration: 3.0 },
    { level: 10, cost: 460, name: 'Molten Pyre X - Hellfire Inferno', description: 'Attacks ignite enemies for 160% Attack power/sec over 3.0s!', multiplier: 1.60, duration: 3.0 }
  ] as EvoAbilityTier[]
};

export const TOWER_DEFINITIONS: Record<TowerType, TowerDef> = {
  [TowerType.SHRINE]: {
    type: TowerType.SHRINE,
    name: 'Vitality Shrine',
    cost: 10,
    description: 'Heals friendly units (+3 HP) as they pass by.',
    color: 0x22c55e, // Emerald Green
    accentColor: 0x86efac,
    range: 3.5,
    rate: 1.0,
    healAmount: 3,
    branchA: [
      {
        name: 'Radiant Sanctuary I',
        cost: 25,
        badge: 'Burst Heal',
        description: 'Increases instant healing to +7 HP per hit.',
        range: 3.8,
        rate: 0.90,
        healAmount: 7
      },
      {
        name: 'Radiant Sanctuary II',
        cost: 50,
        badge: 'Burst Heal',
        description: 'Increases instant healing to +13 HP per hit.',
        range: 4.0,
        rate: 0.85,
        healAmount: 13
      },
      {
        name: 'Radiant Sanctuary III',
        cost: 85,
        badge: 'Burst Heal',
        description: 'Master healing font: +20 HP burst healing per hit.',
        range: 4.2,
        rate: 0.80,
        healAmount: 20
      },
      {
        name: 'Radiant Sanctuary IV',
        cost: 130,
        badge: 'Burst Heal',
        description: 'Divine warmth: +29 HP burst healing per hit.',
        range: 4.3,
        rate: 0.75,
        healAmount: 29
      },
      {
        name: 'Radiant Sanctuary V',
        cost: 180,
        badge: 'Burst Heal',
        description: 'Holy radiance: +40 HP burst healing per hit.',
        range: 4.4,
        rate: 0.70,
        healAmount: 40
      },
      {
        name: 'Radiant Sanctuary VI',
        cost: 240,
        badge: 'Burst Heal',
        description: 'Blissful aura: +52 HP burst healing per hit.',
        range: 4.5,
        rate: 0.65,
        healAmount: 52
      },
      {
        name: 'Radiant Sanctuary VII',
        cost: 310,
        badge: 'Burst Heal',
        description: 'Angelic fountain: +65 HP burst healing per hit.',
        range: 4.6,
        rate: 0.60,
        healAmount: 65
      },
      {
        name: 'Radiant Sanctuary VIII',
        cost: 390,
        badge: 'Burst Heal',
        description: 'Seraphic beacon: +78 HP burst healing per hit.',
        range: 4.7,
        rate: 0.55,
        healAmount: 78
      },
      {
        name: 'Radiant Sanctuary IX',
        cost: 480,
        badge: 'Burst Heal',
        description: 'Immortal reservoir: +91 HP burst healing per hit.',
        range: 4.8,
        rate: 0.50,
        healAmount: 91
      },
      {
        name: 'Radiant Sanctuary X - Divine Avatar',
        cost: 600,
        badge: 'Burst Heal',
        description: 'Avatar of Life: massive +103 HP burst healing per hit at rapid 0.45s pulse!',
        range: 5.0,
        rate: 0.45,
        healAmount: 103
      }
    ],
    branchB: [
      {
        name: 'Lifebloom Grove I',
        cost: 20,
        badge: 'Slow Stacking',
        description: 'Heals +3 HP on hit; Lifebloom grows the heal by +1 HP every round (permanent).',
        range: 3.5,
        rate: 1.0,
        healAmount: 3,
        stackingHpPerRound: 1
      },
      {
        name: 'Lifebloom Grove II',
        cost: 50,
        badge: 'Slow Stacking',
        description: 'Heals +3 HP on hit; Lifebloom grows the heal by +3 HP every round (permanent).',
        range: 3.6,
        rate: 1.0,
        healAmount: 3,
        stackingHpPerRound: 3
      },
      {
        name: 'Lifebloom Grove III',
        cost: 80,
        badge: 'Slow Stacking',
        description: 'Heals +3 HP on hit; Lifebloom grows the heal by +6 HP every round (permanent).',
        range: 3.6,
        rate: 0.98,
        healAmount: 3,
        stackingHpPerRound: 6
      },
      {
        name: 'Lifebloom Grove IV',
        cost: 115,
        badge: 'Slow Stacking',
        description: 'Heals +4 HP on hit; Lifebloom grows the heal by +9 HP every round (permanent).',
        range: 3.7,
        rate: 0.96,
        healAmount: 4,
        stackingHpPerRound: 9
      },
      {
        name: 'Lifebloom Grove V',
        cost: 165,
        badge: 'Slow Stacking',
        description: 'Heals +6 HP on hit; Lifebloom grows the heal by +12 HP every round (permanent).',
        range: 3.7,
        rate: 0.94,
        healAmount: 6,
        stackingHpPerRound: 12
      },
      {
        name: 'Lifebloom Grove VI',
        cost: 225,
        badge: 'Slow Stacking',
        description: 'Heals +8 HP on hit; Lifebloom grows the heal by +16 HP every round (permanent).',
        range: 3.8,
        rate: 0.92,
        healAmount: 8,
        stackingHpPerRound: 16
      },
      {
        name: 'Lifebloom Grove VII',
        cost: 295,
        badge: 'Slow Stacking',
        description: 'Heals +11 HP on hit; Lifebloom grows the heal by +20 HP every round (permanent).',
        range: 3.8,
        rate: 0.90,
        healAmount: 11,
        stackingHpPerRound: 20
      },
      {
        name: 'Lifebloom Grove VIII',
        cost: 375,
        badge: 'Slow Stacking',
        description: 'Heals +15 HP on hit; Lifebloom grows the heal by +24 HP every round (permanent).',
        range: 3.9,
        rate: 0.88,
        healAmount: 15,
        stackingHpPerRound: 24
      },
      {
        name: 'Lifebloom Grove IX',
        cost: 465,
        badge: 'Slow Stacking',
        description: 'Heals +20 HP on hit; Lifebloom grows the heal by +28 HP every round (permanent).',
        range: 3.9,
        rate: 0.85,
        healAmount: 20,
        stackingHpPerRound: 28
      },
      {
        name: 'Lifebloom Grove X - Yggdrasil Heart',
        cost: 580,
        badge: 'Slow Stacking',
        description: 'Heart of Yggdrasil: heals +26 HP on hit; Lifebloom grows the heal by +31 HP every round (permanent).',
        range: 4.0,
        rate: 0.80,
        healAmount: 26,
        stackingHpPerRound: 31
      }
    ]
  },

  [TowerType.FORGE]: {
    type: TowerType.FORGE,
    name: 'Iron Forge',
    cost: 20,
    description: 'Forges armor plating on passing units (+4 Armor), mitigating physical damage.',
    color: 0x64748b, // Slate Steel
    accentColor: 0x38bdf8,
    range: 3.2,
    rate: 1.2,
    armorAmount: 4,
    branchA: [
      {
        name: 'Reinforced Anvil I',
        cost: 30,
        badge: 'Heavy Plating',
        description: 'Forges +8 Armor per hit.',
        range: 3.4,
        rate: 1.15,
        armorAmount: 8
      },
      {
        name: 'Reinforced Anvil II',
        cost: 60,
        badge: 'Heavy Plating',
        description: 'Heavy forging: +13 Armor per hit.',
        range: 3.5,
        rate: 1.10,
        armorAmount: 13
      },
      {
        name: 'Reinforced Anvil III',
        cost: 95,
        badge: 'Heavy Plating',
        description: 'Hardened steel: +18 Armor per hit.',
        range: 3.6,
        rate: 1.05,
        armorAmount: 18
      },
      {
        name: 'Reinforced Anvil IV',
        cost: 140,
        badge: 'Heavy Plating',
        description: 'Mithril weave: +24 Armor per hit.',
        range: 3.7,
        rate: 1.00,
        armorAmount: 24
      },
      {
        name: 'Reinforced Anvil V',
        cost: 195,
        badge: 'Heavy Plating',
        description: 'Dragonscale coat: +30 Armor per hit.',
        range: 3.8,
        rate: 0.95,
        armorAmount: 30
      },
      {
        name: 'Reinforced Anvil VI',
        cost: 260,
        badge: 'Heavy Plating',
        description: 'Obsidian shell: +37 Armor per hit.',
        range: 3.9,
        rate: 0.90,
        armorAmount: 37
      },
      {
        name: 'Reinforced Anvil VII',
        cost: 335,
        badge: 'Heavy Plating',
        description: 'Titanium plating: +45 Armor per hit.',
        range: 4.0,
        rate: 0.85,
        armorAmount: 45
      },
      {
        name: 'Reinforced Anvil VIII',
        cost: 420,
        badge: 'Heavy Plating',
        description: 'Adamantine cuirass: +53 Armor per hit.',
        range: 4.1,
        rate: 0.80,
        armorAmount: 53
      },
      {
        name: 'Reinforced Anvil IX',
        cost: 520,
        badge: 'Heavy Plating',
        description: 'Ethereal bulwark: +61 Armor per hit.',
        range: 4.2,
        rate: 0.75,
        armorAmount: 61
      },
      {
        name: 'Reinforced Anvil X - Adamant Bastion',
        cost: 650,
        badge: 'Heavy Plating',
        description: 'Adamant Bastion: massive +69 Armor per hit at rapid 0.70s strike!',
        range: 4.4,
        rate: 0.70,
        armorAmount: 69
      }
    ],
    branchB: [
      {
        name: 'Tempered Bastion I',
        cost: 45,
        badge: 'Slow Stacking',
        description: 'Grants +4 Armor on hit; tempering grows it by +2 Armor every round (permanent).',
        range: 3.2,
        rate: 1.20,
        armorAmount: 4,
        stackingArmorPerRound: 2
      },
      {
        name: 'Tempered Bastion II',
        cost: 50,
        badge: 'Slow Stacking',
        description: 'Grants +4 Armor on hit; tempering grows it by +4 Armor every round (permanent).',
        range: 3.3,
        rate: 1.18,
        armorAmount: 4,
        stackingArmorPerRound: 4
      },
      {
        name: 'Tempered Bastion III',
        cost: 80,
        badge: 'Slow Stacking',
        description: 'Grants +4 Armor on hit; tempering grows it by +7 Armor every round (permanent).',
        range: 3.4,
        rate: 1.15,
        armorAmount: 4,
        stackingArmorPerRound: 7
      },
      {
        name: 'Tempered Bastion IV',
        cost: 120,
        badge: 'Slow Stacking',
        description: 'Grants +4 Armor on hit; tempering grows it by +11 Armor every round (permanent).',
        range: 3.4,
        rate: 1.12,
        armorAmount: 4,
        stackingArmorPerRound: 11
      },
      {
        name: 'Tempered Bastion V',
        cost: 170,
        badge: 'Slow Stacking',
        description: 'Grants +4 Armor on hit; tempering grows it by +16 Armor every round (permanent).',
        range: 3.5,
        rate: 1.10,
        armorAmount: 4,
        stackingArmorPerRound: 16
      },
      {
        name: 'Tempered Bastion VI',
        cost: 230,
        badge: 'Slow Stacking',
        description: 'Grants +5 Armor on hit; tempering grows it by +21 Armor every round (permanent).',
        range: 3.5,
        rate: 1.05,
        armorAmount: 5,
        stackingArmorPerRound: 21
      },
      {
        name: 'Tempered Bastion VII',
        cost: 300,
        badge: 'Slow Stacking',
        description: 'Grants +7 Armor on hit; tempering grows it by +26 Armor every round (permanent).',
        range: 3.6,
        rate: 1.00,
        armorAmount: 7,
        stackingArmorPerRound: 26
      },
      {
        name: 'Tempered Bastion VIII',
        cost: 380,
        badge: 'Slow Stacking',
        description: 'Grants +9 Armor on hit; tempering grows it by +31 Armor every round (permanent).',
        range: 3.7,
        rate: 0.95,
        armorAmount: 9,
        stackingArmorPerRound: 31
      },
      {
        name: 'Tempered Bastion IX',
        cost: 470,
        badge: 'Slow Stacking',
        description: 'Grants +12 Armor on hit; tempering grows it by +35 Armor every round (permanent).',
        range: 3.7,
        rate: 0.90,
        armorAmount: 12,
        stackingArmorPerRound: 35
      },
      {
        name: 'Tempered Bastion X - Eternal Fortress',
        cost: 580,
        badge: 'Slow Stacking',
        description: 'Eternal Fortress: grants +16 Armor on hit; tempering grows it by +38 Armor every round (permanent).',
        range: 3.8,
        rate: 0.85,
        armorAmount: 16,
        stackingArmorPerRound: 38
      }
    ]
  },

  [TowerType.OBELISK]: {
    type: TowerType.OBELISK,
    name: 'Flame Obelisk',
    cost: 20,
    description: 'Infuses weapons with flame, increasing unit attack damage (+4 Attack).',
    color: 0xf97316, // Fire Orange
    accentColor: 0xfde047,
    range: 3.5,
    rate: 1.1,
    attackAmount: 4,
    branchA: [
      {
        name: 'War Pillar I',
        cost: 30,
        badge: 'High Impact',
        description: 'Infuses +8 Attack damage per hit.',
        range: 3.6,
        rate: 1.05,
        attackAmount: 8
      },
      {
        name: 'War Pillar II',
        cost: 60,
        badge: 'High Impact',
        description: 'Blazing edge: +13 Attack damage per hit.',
        range: 3.7,
        rate: 1.00,
        attackAmount: 13
      },
      {
        name: 'War Pillar III',
        cost: 95,
        badge: 'High Impact',
        description: 'Scorching strike: +19 Attack damage per hit.',
        range: 3.8,
        rate: 0.95,
        attackAmount: 19
      },
      {
        name: 'War Pillar IV',
        cost: 140,
        badge: 'High Impact',
        description: 'Ignited edge: +26 Attack damage per hit.',
        range: 3.9,
        rate: 0.90,
        attackAmount: 26
      },
      {
        name: 'War Pillar V',
        cost: 195,
        badge: 'High Impact',
        description: 'Searing heat: +34 Attack damage per hit.',
        range: 4.0,
        rate: 0.85,
        attackAmount: 34
      },
      {
        name: 'War Pillar VI',
        cost: 260,
        badge: 'High Impact',
        description: 'Volcanic thrust: +43 Attack damage per hit.',
        range: 4.1,
        rate: 0.80,
        attackAmount: 43
      },
      {
        name: 'War Pillar VII',
        cost: 335,
        badge: 'High Impact',
        description: 'Inferno blade: +53 Attack damage per hit.',
        range: 4.2,
        rate: 0.75,
        attackAmount: 53
      },
      {
        name: 'War Pillar VIII',
        cost: 420,
        badge: 'High Impact',
        description: 'Pyre wrath: +63 Attack damage per hit.',
        range: 4.3,
        rate: 0.70,
        attackAmount: 63
      },
      {
        name: 'War Pillar IX',
        cost: 520,
        badge: 'High Impact',
        description: 'Solar conflagration: +73 Attack damage per hit.',
        range: 4.4,
        rate: 0.65,
        attackAmount: 73
      },
      {
        name: 'War Pillar X - Inferno Sovereign',
        cost: 650,
        badge: 'High Impact',
        description: 'Inferno Sovereign: colossal +83 Attack damage per hit at rapid 0.60s strike!',
        range: 4.6,
        rate: 0.60,
        attackAmount: 83
      }
    ],
    branchB: [
      {
        name: 'Frenzy Monolith I',
        cost: 45,
        badge: 'Slow Stacking',
        description: 'Grants +4 Attack on hit; frenzy grows it by +2 Attack every round (permanent).',
        range: 3.5,
        rate: 1.10,
        attackAmount: 4,
        stackingAttackPerRound: 2
      },
      {
        name: 'Frenzy Monolith II',
        cost: 50,
        badge: 'Slow Stacking',
        description: 'Grants +4 Attack on hit; frenzy grows it by +4 Attack every round (permanent).',
        range: 3.5,
        rate: 1.08,
        attackAmount: 4,
        stackingAttackPerRound: 4
      },
      {
        name: 'Frenzy Monolith III',
        cost: 80,
        badge: 'Slow Stacking',
        description: 'Grants +4 Attack on hit; frenzy grows it by +7 Attack every round (permanent).',
        range: 3.6,
        rate: 1.05,
        attackAmount: 4,
        stackingAttackPerRound: 7
      },
      {
        name: 'Frenzy Monolith IV',
        cost: 120,
        badge: 'Slow Stacking',
        description: 'Grants +4 Attack on hit; frenzy grows it by +11 Attack every round (permanent).',
        range: 3.6,
        rate: 1.02,
        attackAmount: 4,
        stackingAttackPerRound: 11
      },
      {
        name: 'Frenzy Monolith V',
        cost: 170,
        badge: 'Slow Stacking',
        description: 'Grants +4 Attack on hit; frenzy grows it by +16 Attack every round (permanent).',
        range: 3.7,
        rate: 1.00,
        attackAmount: 4,
        stackingAttackPerRound: 16
      },
      {
        name: 'Frenzy Monolith VI',
        cost: 230,
        badge: 'Slow Stacking',
        description: 'Grants +5 Attack on hit; frenzy grows it by +21 Attack every round (permanent).',
        range: 3.7,
        rate: 0.96,
        attackAmount: 5,
        stackingAttackPerRound: 21
      },
      {
        name: 'Frenzy Monolith VII',
        cost: 300,
        badge: 'Slow Stacking',
        description: 'Grants +7 Attack on hit; frenzy grows it by +26 Attack every round (permanent).',
        range: 3.8,
        rate: 0.92,
        attackAmount: 7,
        stackingAttackPerRound: 26
      },
      {
        name: 'Frenzy Monolith VIII',
        cost: 380,
        badge: 'Slow Stacking',
        description: 'Grants +9 Attack on hit; frenzy grows it by +31 Attack every round (permanent).',
        range: 3.8,
        rate: 0.88,
        attackAmount: 9,
        stackingAttackPerRound: 31
      },
      {
        name: 'Frenzy Monolith IX',
        cost: 470,
        badge: 'Slow Stacking',
        description: 'Grants +12 Attack on hit; frenzy grows it by +35 Attack every round (permanent).',
        range: 3.9,
        rate: 0.84,
        attackAmount: 12,
        stackingAttackPerRound: 35
      },
      {
        name: 'Frenzy Monolith X - Cataclysm Core',
        cost: 580,
        badge: 'Slow Stacking',
        description: 'Cataclysm Core: grants +16 Attack on hit; frenzy grows it by +38 Attack every round (permanent).',
        range: 4.0,
        rate: 0.80,
        attackAmount: 16,
        stackingAttackPerRound: 38
      }
    ]
  },

  [TowerType.AURA]: {
    type: TowerType.AURA,
    name: 'Aura Spire',
    cost: 50,
    description: 'Emits a haste field that increases the attack/cast speed of all towers in range (+35% haste). Haste fields do not stack (each tower takes the strongest) and do not affect Gold Spires.',
    color: 0xa855f7, // Arcane Purple
    accentColor: 0xf472b6,
    range: 4.2,
    rate: 2.0,
    auraSpeedBonus: 0.35, // +35% cast speed to nearby towers
    branchA: [
      {
        name: 'Clockwork Overdrive I',
        cost: 60,
        badge: 'Hyper-Haste',
        description: 'Concentrated aura providing +50% attack speed to nearby towers.',
        range: 3.4,
        rate: 2.0,
        auraSpeedBonus: 0.5
      },
      {
        name: 'Clockwork Overdrive II',
        cost: 95,
        badge: 'Hyper-Haste',
        description: 'Overcharged field: +70% attack speed to nearby towers.',
        range: 3.5,
        rate: 2.0,
        auraSpeedBonus: 0.7
      },
      {
        name: 'Clockwork Overdrive III',
        cost: 140,
        badge: 'Hyper-Haste',
        description: 'Flux accelerator: +95% attack speed to nearby towers.',
        range: 3.6,
        rate: 2.0,
        auraSpeedBonus: 0.95
      },
      {
        name: 'Clockwork Overdrive IV',
        cost: 195,
        badge: 'Hyper-Haste',
        description: 'Temporal warp: +125% attack speed to nearby towers.',
        range: 3.7,
        rate: 2.0,
        auraSpeedBonus: 1.25
      },
      {
        name: 'Clockwork Overdrive V',
        cost: 260,
        badge: 'Hyper-Haste',
        description: 'Chrono matrix: +160% attack speed to nearby towers.',
        range: 3.8,
        rate: 2.0,
        auraSpeedBonus: 1.6
      },
      {
        name: 'Clockwork Overdrive VI',
        cost: 335,
        badge: 'Hyper-Haste',
        description: 'Aetheric tachyon: +200% attack speed to nearby towers.',
        range: 3.9,
        rate: 2.0,
        auraSpeedBonus: 2
      },
      {
        name: 'Clockwork Overdrive VII',
        cost: 420,
        badge: 'Hyper-Haste',
        description: 'Hyper-frequency: +245% attack speed to nearby towers.',
        range: 4.0,
        rate: 2.0,
        auraSpeedBonus: 2.45
      },
      {
        name: 'Clockwork Overdrive VIII',
        cost: 520,
        badge: 'Hyper-Haste',
        description: 'Quantum surge: +295% attack speed to nearby towers.',
        range: 4.1,
        rate: 2.0,
        auraSpeedBonus: 2.95
      },
      {
        name: 'Clockwork Overdrive IX',
        cost: 630,
        badge: 'Hyper-Haste',
        description: 'Warp singularity: +350% attack speed to nearby towers.',
        range: 4.2,
        rate: 2.0,
        auraSpeedBonus: 3.5
      },
      {
        name: 'Clockwork Overdrive X - Chrono Horizon',
        cost: 760,
        badge: 'Hyper-Haste',
        description: 'Chrono Horizon: titanic +415% attack speed acceleration to surrounding towers!',
        range: 4.4,
        rate: 2.0,
        auraSpeedBonus: 4.15
      }
    ],
    branchB: [
      {
        name: 'Expansive Resonance I',
        cost: 55,
        badge: 'Wide Field',
        description: 'Broadened aura zone (range 5.2) boosting all towers by +41% attack speed.',
        range: 5.2,
        rate: 2.0,
        auraSpeedBonus: 0.41
      },
      {
        name: 'Expansive Resonance II',
        cost: 90,
        badge: 'Wide Field',
        description: 'Expansive pulse (range 6.0) boosting all towers by +51% attack speed.',
        range: 6.0,
        rate: 2.0,
        auraSpeedBonus: 0.51
      },
      {
        name: 'Expansive Resonance III',
        cost: 130,
        badge: 'Wide Field',
        description: 'Harmonic beacon (range 6.8) boosting all towers by +61% attack speed.',
        range: 6.8,
        rate: 2.0,
        auraSpeedBonus: 0.61
      },
      {
        name: 'Expansive Resonance IV',
        cost: 180,
        badge: 'Wide Field',
        description: 'Grand resonance (range 7.5) boosting all towers by +73% attack speed.',
        range: 7.5,
        rate: 2.0,
        auraSpeedBonus: 0.73
      },
      {
        name: 'Expansive Resonance V',
        cost: 240,
        badge: 'Wide Field',
        description: 'Sanctum broadcast (range 8.2) boosting all towers by +84% attack speed.',
        range: 8.2,
        rate: 2.0,
        auraSpeedBonus: 0.84
      },
      {
        name: 'Expansive Resonance VI',
        cost: 310,
        badge: 'Wide Field',
        description: 'Leyline conduit (range 8.8) boosting all towers by +97% attack speed.',
        range: 8.8,
        rate: 2.0,
        auraSpeedBonus: 0.97
      },
      {
        name: 'Expansive Resonance VII',
        cost: 390,
        badge: 'Wide Field',
        description: 'Island harmonizer (range 9.4) boosting all towers by +110% attack speed.',
        range: 9.4,
        rate: 2.0,
        auraSpeedBonus: 1.1
      },
      {
        name: 'Expansive Resonance VIII',
        cost: 480,
        badge: 'Wide Field',
        description: 'Aetheric nexus (range 10.0) boosting all towers by +123% attack speed.',
        range: 10.0,
        rate: 2.0,
        auraSpeedBonus: 1.23
      },
      {
        name: 'Expansive Resonance IX',
        cost: 580,
        badge: 'Wide Field',
        description: 'Celestial grid (range 10.6) boosting all towers by +134% attack speed.',
        range: 10.6,
        rate: 2.0,
        auraSpeedBonus: 1.34
      },
      {
        name: 'Expansive Resonance X - Realm Beacon',
        cost: 700,
        badge: 'Wide Field',
        description: 'Realm Beacon: massive island-wide range (11.4 tiles) boosting all towers by +141% attack speed!',
        range: 11.4,
        rate: 2.0,
        auraSpeedBonus: 1.41
      }
    ]
  },

  [TowerType.FROST]: {
    type: TowerType.FROST,
    name: 'Frost Monolith',
    cost: 25,
    description: 'Chills passing friendly units (30% slow for 2.8s) to keep them in the maze longer for more buffs!',
    color: 0x06b6d4, // Cyan Ice
    accentColor: 0xa5f3fc,
    range: 3.8,
    rate: 1.4,
    slowPercent: 0.30, // 30% base slow
    slowDuration: 2.8,
    branchA: [
      {
        name: 'Deep Freeze I',
        cost: 45,
        badge: 'Maximum Dwell',
        description: 'Chills units with a 36% slow for 3.2s for increased buff exposure.',
        range: 3.9,
        rate: 1.35,
        slowPercent: 0.36,
        slowDuration: 3.2
      },
      {
        name: 'Deep Freeze II',
        cost: 75,
        badge: 'Maximum Dwell',
        description: 'Super-chills units with a 43% slow for 3.6s for increased buff exposure.',
        range: 4.0,
        rate: 1.30,
        slowPercent: 0.43,
        slowDuration: 3.6
      },
      {
        name: 'Deep Freeze III',
        cost: 115,
        badge: 'Maximum Dwell',
        description: 'Permafrost coating: 50% movement slow for 4.0s.',
        range: 4.1,
        rate: 1.25,
        slowPercent: 0.5,
        slowDuration: 4.0
      },
      {
        name: 'Deep Freeze IV',
        cost: 165,
        badge: 'Maximum Dwell',
        description: 'Glacial stasis: 56% movement slow for 4.4s.',
        range: 4.2,
        rate: 1.20,
        slowPercent: 0.56,
        slowDuration: 4.4
      },
      {
        name: 'Deep Freeze V',
        cost: 225,
        badge: 'Maximum Dwell',
        description: 'Cryo-lock: 61% movement slow for 4.8s.',
        range: 4.3,
        rate: 1.15,
        slowPercent: 0.61,
        slowDuration: 4.8
      },
      {
        name: 'Deep Freeze VI',
        cost: 295,
        badge: 'Maximum Dwell',
        description: 'Rime binding: 65% movement slow for 5.2s.',
        range: 4.4,
        rate: 1.10,
        slowPercent: 0.65,
        slowDuration: 5.2
      },
      {
        name: 'Deep Freeze VII',
        cost: 375,
        badge: 'Maximum Dwell',
        description: 'Frost lock: 68% movement slow for 5.6s.',
        range: 4.5,
        rate: 1.05,
        slowPercent: 0.68,
        slowDuration: 5.6
      },
      {
        name: 'Deep Freeze VIII',
        cost: 465,
        badge: 'Maximum Dwell',
        description: 'Zero drift: 70% movement slow for 6.0s.',
        range: 4.6,
        rate: 1.00,
        slowPercent: 0.7,
        slowDuration: 6.0
      },
      {
        name: 'Deep Freeze IX',
        cost: 565,
        badge: 'Maximum Dwell',
        description: 'Sub-zero capture: 71% movement slow for 6.5s.',
        range: 4.7,
        rate: 0.95,
        slowPercent: 0.71,
        slowDuration: 6.5
      },
      {
        name: 'Deep Freeze X - Absolute Zero',
        cost: 680,
        badge: 'Maximum Dwell',
        description: 'Absolute Zero: maximum 72% movement freeze lasting 7.0s!',
        range: 4.8,
        rate: 0.90,
        slowPercent: 0.72,
        slowDuration: 7.0
      }
    ],
    branchB: [
      {
        name: 'Blizzard Zone I',
        cost: 40,
        badge: 'AoE Chill',
        description: 'Pulsing blizzard zone (range 4.6) chilling all units in range by 29%.',
        range: 4.6,
        rate: 1.25,
        slowPercent: 0.29,
        slowDuration: 3.0
      },
      {
        name: 'Blizzard Zone II',
        cost: 70,
        badge: 'AoE Chill',
        description: 'Expanded blizzard (range 5.2) chilling all units in range by 31%.',
        range: 5.2,
        rate: 1.20,
        slowPercent: 0.31,
        slowDuration: 3.2
      },
      {
        name: 'Blizzard Zone III',
        cost: 110,
        badge: 'AoE Chill',
        description: 'Howling gale (range 5.8) chilling all units in range by 34%.',
        range: 5.8,
        rate: 1.15,
        slowPercent: 0.34,
        slowDuration: 3.5
      },
      {
        name: 'Blizzard Zone IV',
        cost: 155,
        badge: 'AoE Chill',
        description: 'Frost vortex (range 6.4) chilling all units in range by 37%.',
        range: 6.4,
        rate: 1.10,
        slowPercent: 0.37,
        slowDuration: 3.8
      },
      {
        name: 'Blizzard Zone V',
        cost: 210,
        badge: 'AoE Chill',
        description: 'Freezing squall (range 7.0) chilling all units in range by 40%.',
        range: 7.0,
        rate: 1.05,
        slowPercent: 0.4,
        slowDuration: 4.1
      },
      {
        name: 'Blizzard Zone VI',
        cost: 275,
        badge: 'AoE Chill',
        description: 'Whiteout field (range 7.6) chilling all units in range by 43%.',
        range: 7.6,
        rate: 1.00,
        slowPercent: 0.43,
        slowDuration: 4.4
      },
      {
        name: 'Blizzard Zone VII',
        cost: 350,
        badge: 'AoE Chill',
        description: 'Glacial typhoon (range 8.2) chilling all units in range by 45%.',
        range: 8.2,
        rate: 0.95,
        slowPercent: 0.45,
        slowDuration: 4.7
      },
      {
        name: 'Blizzard Zone VIII',
        cost: 435,
        badge: 'AoE Chill',
        description: 'Cryo storm (range 8.8) chilling all units in range by 47%.',
        range: 8.8,
        rate: 0.90,
        slowPercent: 0.47,
        slowDuration: 5.0
      },
      {
        name: 'Blizzard Zone IX',
        cost: 530,
        badge: 'AoE Chill',
        description: 'Permafrost dome (range 9.4) chilling all units in range by 49%.',
        range: 9.4,
        rate: 0.85,
        slowPercent: 0.49,
        slowDuration: 5.3
      },
      {
        name: 'Blizzard Zone X - Glacial Vortex',
        cost: 640,
        badge: 'AoE Chill',
        description: 'Glacial Vortex: immense 10.2 tile tempest chilling all units by 50% (0.80s pulse)!',
        range: 10.2,
        rate: 0.80,
        slowPercent: 0.5,
        slowDuration: 5.8
      }
    ]
  },

  [TowerType.RULEBREAKER]: {
    type: TowerType.RULEBREAKER,
    name: 'The Rulebreaker',
    cost: 35,
    description: 'Rewrites unit reality, directly setting passing unit HP to a fixed 35 HP.',
    color: 0xe11d48, // Crimson Arcane
    accentColor: 0xf43f5e,
    range: 3.0,
    rate: 1.5,
    fixedHp: 35,
    branchA: [
      {
        name: 'Titan Core I',
        cost: 50,
        badge: 'Aggressive HP',
        description: 'Aggressive HP surge: directly sets passing unit HP to 75 HP (slow 1.5s cast rate).',
        range: 3.0,
        rate: 1.5,
        fixedHp: 75
      },
      {
        name: 'Titan Core II',
        cost: 100,
        badge: 'Aggressive HP',
        description: 'Titanic leap: directly sets passing unit HP to 150 HP (slow 1.5s cast rate).',
        range: 3.1,
        rate: 1.5,
        fixedHp: 150
      },
      {
        name: 'Titan Core III - Colossus Forge',
        cost: 175,
        badge: 'Aggressive HP',
        description: 'Colossus Forge: sets unit HP to 250 HP cap (slow 1.5s cast rate)! Primes units for the Evolution Spire.',
        range: 3.2,
        rate: 1.5,
        fixedHp: 250
      }
    ],
    branchB: [
      {
        name: 'Chrono Transmuter I',
        cost: 45,
        badge: 'Rapid Cast',
        description: 'Accelerated shift: sets unit HP to 60 HP at hyper-speed 0.45s cast rate.',
        range: 3.0,
        rate: 0.45,
        fixedHp: 60
      },
      {
        name: 'Chrono Transmuter II',
        cost: 75,
        badge: 'Rapid Cast',
        description: 'Rapid transmuter: sets unit HP to 105 HP at hyper-speed 0.45s cast rate.',
        range: 3.1,
        rate: 0.45,
        fixedHp: 105
      },
      {
        name: 'Chrono Transmuter III',
        cost: 115,
        badge: 'Rapid Cast',
        description: 'High-speed reality warping: sets unit HP to 150 HP at hyper-speed 0.45s cast rate.',
        range: 3.2,
        rate: 0.45,
        fixedHp: 150
      },
      {
        name: 'Chrono Transmuter IV',
        cost: 165,
        badge: 'Rapid Cast',
        description: 'Blistering shift: sets unit HP to 200 HP at hyper-speed 0.45s cast rate.',
        range: 3.3,
        rate: 0.45,
        fixedHp: 200
      },
      {
        name: 'Chrono Transmuter V - Singularity',
        cost: 230,
        badge: 'Rapid Cast',
        description: 'Temporal Singularity: sets unit HP to 250 HP cap at hyper-speed 0.45s cast rate, transmuting entire passing battalions!',
        range: 3.4,
        rate: 0.45,
        fixedHp: 250
      }
    ]
  },

  [TowerType.GOLD]: {
    type: TowerType.GOLD,
    name: 'Gold Spire',
    cost: 30,
    description: 'Generates extra gold (+2g on hit) to fuel your defensive economy.',
    color: 0xeab308, // Gold
    accentColor: 0xfef08a,
    range: 3.5,
    rate: 1.2,
    goldPerHit: 2,
    branchA: [
      {
        name: 'Midas Siphon I',
        cost: 40,
        badge: 'Gold on Hit',
        description: 'Generates +4 Gold every time it hits a passing unit.',
        range: 3.6,
        rate: 1.15,
        goldPerHit: 4
      },
      {
        name: 'Midas Siphon II',
        cost: 65,
        badge: 'Gold on Hit',
        description: 'Generates +7 Gold every time it hits a passing unit.',
        range: 3.7,
        rate: 1.10,
        goldPerHit: 7
      },
      {
        name: 'Midas Siphon III',
        cost: 100,
        badge: 'Gold on Hit',
        description: 'Generates +11 Gold every time it hits a passing unit.',
        range: 3.8,
        rate: 1.05,
        goldPerHit: 11
      },
      {
        name: 'Midas Siphon IV',
        cost: 145,
        badge: 'Gold on Hit',
        description: 'Generates +16 Gold every time it hits a passing unit.',
        range: 3.9,
        rate: 1.00,
        goldPerHit: 16
      },
      {
        name: 'Midas Siphon V',
        cost: 200,
        badge: 'Gold on Hit',
        description: 'Generates +22 Gold every time it hits a passing unit.',
        range: 4.0,
        rate: 0.95,
        goldPerHit: 22
      },
      {
        name: 'Midas Siphon VI',
        cost: 265,
        badge: 'Gold on Hit',
        description: 'Generates +29 Gold every time it hits a passing unit.',
        range: 4.1,
        rate: 0.90,
        goldPerHit: 29
      },
      {
        name: 'Midas Siphon VII',
        cost: 340,
        badge: 'Gold on Hit',
        description: 'Generates +37 Gold every time it hits a passing unit.',
        range: 4.2,
        rate: 0.85,
        goldPerHit: 37
      },
      {
        name: 'Midas Siphon VIII',
        cost: 425,
        badge: 'Gold on Hit',
        description: 'Generates +44 Gold every time it hits a passing unit.',
        range: 4.3,
        rate: 0.80,
        goldPerHit: 44
      },
      {
        name: 'Midas Siphon IX',
        cost: 520,
        badge: 'Gold on Hit',
        description: 'Generates +51 Gold every time it hits a passing unit.',
        range: 4.4,
        rate: 0.75,
        goldPerHit: 51
      },
      {
        name: 'Midas Siphon X - Philosopher Touch',
        cost: 630,
        badge: 'Gold on Hit',
        description: 'Philosopher Touch: generates +58 Gold on rapid strike (+58g every 0.70s)!',
        range: 4.5,
        rate: 0.70,
        goldPerHit: 58
      }
    ],
    branchB: [
      {
        name: 'Vault Reserve I',
        cost: 40,
        badge: 'Round Interest',
        description: 'Safeguards capital: yields 5% interest on your reserve at round end (min 10g, max 40g). No on-hit gold.',
        range: 3.3,
        rate: 1.25,
        roundInterestPercent: 0.05,
        roundFlatGold: 10,
        roundInterestCap: 40
      },
      {
        name: 'Vault Reserve II',
        cost: 70,
        badge: 'Round Interest',
        description: 'Secure vaults: yields 6% interest on your reserve at round end (min 15g, max 70g). No on-hit gold.',
        range: 3.4,
        rate: 1.20,
        roundInterestPercent: 0.06,
        roundFlatGold: 15,
        roundInterestCap: 70
      },
      {
        name: 'Vault Reserve III',
        cost: 110,
        badge: 'Round Interest',
        description: 'Fortified repository: yields 7% interest on your reserve at round end (min 20g, max 115g). No on-hit gold.',
        range: 3.5,
        rate: 1.18,
        roundInterestPercent: 0.07,
        roundFlatGold: 20,
        roundInterestCap: 115
      },
      {
        name: 'Vault Reserve IV',
        cost: 160,
        badge: 'Round Interest',
        description: 'Treasury reserve: yields 8% interest on your reserve at round end (min 30g, max 175g). No on-hit gold.',
        range: 3.5,
        rate: 1.15,
        roundInterestPercent: 0.08,
        roundFlatGold: 30,
        roundInterestCap: 175
      },
      {
        name: 'Vault Reserve V',
        cost: 220,
        badge: 'Round Interest',
        description: 'High-capital bank: yields 9% interest on your reserve at round end (min 40g, max 250g). No on-hit gold.',
        range: 3.6,
        rate: 1.12,
        roundInterestPercent: 0.09,
        roundFlatGold: 40,
        roundInterestCap: 250
      },
      {
        name: 'Vault Reserve VI',
        cost: 290,
        badge: 'Round Interest',
        description: 'Guild bullion vault: yields 10% interest on your reserve at round end (min 50g, max 345g). No on-hit gold.',
        range: 3.6,
        rate: 1.10,
        roundInterestPercent: 0.10,
        roundFlatGold: 50,
        roundInterestCap: 345
      },
      {
        name: 'Vault Reserve VII',
        cost: 370,
        badge: 'Round Interest',
        description: 'Royal exchange: yields 11% interest on your reserve at round end (min 60g, max 455g). No on-hit gold.',
        range: 3.7,
        rate: 1.05,
        roundInterestPercent: 0.11,
        roundFlatGold: 60,
        roundInterestCap: 455
      },
      {
        name: 'Vault Reserve VIII',
        cost: 460,
        badge: 'Round Interest',
        description: 'Crown sovereign fund: yields 12% interest on your reserve at round end (min 75g, max 580g). No on-hit gold.',
        range: 3.7,
        rate: 1.00,
        roundInterestPercent: 0.12,
        roundFlatGold: 75,
        roundInterestCap: 580
      },
      {
        name: 'Vault Reserve IX',
        cost: 560,
        badge: 'Round Interest',
        description: 'Monarch exchequer: yields 13% interest on your reserve at round end (min 90g, max 725g). No on-hit gold.',
        range: 3.8,
        rate: 0.95,
        roundInterestPercent: 0.13,
        roundFlatGold: 90,
        roundInterestCap: 725
      },
      {
        name: 'Vault Reserve X - Imperial Treasury',
        cost: 680,
        badge: 'Round Interest',
        description: 'Imperial Treasury: yields 15% interest on your reserve at round end (min 110g, max 890g). No on-hit gold.',
        range: 3.8,
        rate: 0.90,
        roundInterestPercent: 0.15,
        roundFlatGold: 110,
        roundInterestCap: 890
      }
    ]
  },

  [TowerType.EVOLUTION]: {
    type: TowerType.EVOLUTION,
    name: 'Evolution Spire',
    cost: 100,
    description: 'Evolves a single 250 HP unit per wave into a Soldier, Archer, or Mage champion with upgraded abilities.',
    color: 0x8b5cf6, // Violet
    accentColor: 0xc4b5fd,
    range: 3.0,
    rate: 1.0,
    branchA: [
      {
        name: 'Soldier Forge',
        cost: 0,
        badge: 'Melee Champion',
        description: 'Evolves 1 unit (at 250 HP) per wave into a Soldier (3,750 HP cap) with Armor Aura and Relentless Assault.',
        range: 3.0,
        rate: 1.0
      }
    ],
    branchB: [
      {
        name: 'Archer Forge',
        cost: 0,
        badge: 'Ranged Marksman',
        description: 'Evolves 1 unit (at 250 HP) per wave into an Archer (3,000 HP cap) with Multishot and Damage Aura.',
        range: 3.0,
        rate: 1.0
      }
    ],
    branchC: [
      {
        name: 'Mage Sanctum',
        cost: 0,
        badge: 'Arcane Pyromancer',
        description: 'Evolves 1 unit (at 250 HP) per wave into a Mage (2,550 HP cap). Generates mana on attack, casting an explosive AoE Mega Fireball at full mana.',
        range: 3.0,
        rate: 1.0
      }
    ]
  }
};

