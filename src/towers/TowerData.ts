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
  bonus?: number; // Armor aura bonus, damage aura bonus, fireball radius, or general bonus
  chance?: number; // Crit chance, multishot chance, or stun chance
  multiplier?: number; // Crit multiplier, fireball damage multiplier, thorns multiplier, or burn multiplier
  targets?: number; // Multishot target count
  duration?: number; // Stun duration or debuff duration
  secondaryBonus?: number; // Flat damage reduction or secondary stat
}

export const SOLDIER_ABILITIES = {
  armorAura: [
    { level: 1, cost: 40, name: 'Armor Aura I', description: 'Radiates +6 Armor to all surrounding allies in combat.', bonus: 6 },
    { level: 2, cost: 70, name: 'Armor Aura II', description: 'Radiates +12 Armor to all surrounding allies in combat.', bonus: 12 },
    { level: 3, cost: 110, name: 'Armor Aura III', description: 'Radiates +20 Armor to all surrounding allies in combat.', bonus: 20 },
    { level: 4, cost: 160, name: 'Armor Aura IV', description: 'Radiates +30 Armor to all surrounding allies in combat.', bonus: 30 },
    { level: 5, cost: 220, name: 'Armor Aura V', description: 'Radiates +42 Armor to all surrounding allies in combat.', bonus: 42 },
    { level: 6, cost: 290, name: 'Armor Aura VI', description: 'Radiates +56 Armor to all surrounding allies in combat.', bonus: 56 },
    { level: 7, cost: 370, name: 'Armor Aura VII', description: 'Radiates +72 Armor to all surrounding allies in combat.', bonus: 72 },
    { level: 8, cost: 460, name: 'Armor Aura VIII', description: 'Radiates +90 Armor to all surrounding allies in combat.', bonus: 90 },
    { level: 9, cost: 560, name: 'Armor Aura IX', description: 'Radiates +112 Armor to all surrounding allies in combat.', bonus: 112 },
    { level: 10, cost: 680, name: 'Armor Aura X - Aegis of the Sun', description: 'Radiates +140 Armor to all surrounding allies in combat!', bonus: 140 }
  ] as EvoAbilityTier[],
  crit: [
    { level: 1, cost: 40, name: 'Critical Strike I', description: '25% chance to deal 2.0x Critical Strike damage.', chance: 0.25, multiplier: 2.0 },
    { level: 2, cost: 70, name: 'Critical Strike II', description: '30% chance to deal 2.3x Critical Strike damage.', chance: 0.30, multiplier: 2.3 },
    { level: 3, cost: 110, name: 'Critical Strike III', description: '35% chance to deal 2.6x Critical Strike damage.', chance: 0.35, multiplier: 2.6 },
    { level: 4, cost: 160, name: 'Critical Strike IV', description: '40% chance to deal 3.0x Critical Strike damage.', chance: 0.40, multiplier: 3.0 },
    { level: 5, cost: 220, name: 'Critical Strike V', description: '45% chance to deal 3.4x Critical Strike damage.', chance: 0.45, multiplier: 3.4 },
    { level: 6, cost: 290, name: 'Critical Strike VI', description: '50% chance to deal 3.8x Critical Strike damage.', chance: 0.50, multiplier: 3.8 },
    { level: 7, cost: 370, name: 'Critical Strike VII', description: '55% chance to deal 4.3x Critical Strike damage.', chance: 0.55, multiplier: 4.3 },
    { level: 8, cost: 460, name: 'Critical Strike VIII', description: '60% chance to deal 4.8x Critical Strike damage.', chance: 0.60, multiplier: 4.8 },
    { level: 9, cost: 560, name: 'Critical Strike IX', description: '65% chance to deal 5.4x Critical Strike damage.', chance: 0.65, multiplier: 5.4 },
    { level: 10, cost: 680, name: 'Critical Strike X - Guillotine', description: '70% chance to deal 6.0x Critical Strike damage!', chance: 0.70, multiplier: 6.0 }
  ] as EvoAbilityTier[],
  lifeRegen: [
    { level: 1, cost: 40, name: 'Iron Vigor I', description: 'Passively regenerates +12 HP/sec in combat.', bonus: 12 },
    { level: 2, cost: 70, name: 'Iron Vigor II', description: 'Passively regenerates +20 HP/sec in combat.', bonus: 20 },
    { level: 3, cost: 110, name: 'Iron Vigor III', description: 'Passively regenerates +32 HP/sec in combat.', bonus: 32 },
    { level: 4, cost: 160, name: 'Iron Vigor IV', description: 'Passively regenerates +48 HP/sec in combat.', bonus: 48 },
    { level: 5, cost: 220, name: 'Iron Vigor V', description: 'Passively regenerates +70 HP/sec in combat.', bonus: 70 },
    { level: 6, cost: 290, name: 'Iron Vigor VI', description: 'Passively regenerates +95 HP/sec in combat.', bonus: 95 },
    { level: 7, cost: 370, name: 'Iron Vigor VII', description: 'Passively regenerates +125 HP/sec in combat.', bonus: 125 },
    { level: 8, cost: 460, name: 'Iron Vigor VIII', description: 'Passively regenerates +160 HP/sec in combat.', bonus: 160 },
    { level: 9, cost: 560, name: 'Iron Vigor IX', description: 'Passively regenerates +200 HP/sec in combat.', bonus: 200 },
    { level: 10, cost: 680, name: 'Iron Vigor X - Undying Resolve', description: 'Passively regenerates +250 HP/sec in combat!', bonus: 250 }
  ] as EvoAbilityTier[],
  thorns: [
    { level: 1, cost: 40, name: 'Spiked Bulwark I', description: 'Reduces incoming damage by 3 and reflects 25% melee damage back.', multiplier: 0.25, secondaryBonus: 3 },
    { level: 2, cost: 70, name: 'Spiked Bulwark II', description: 'Reduces incoming damage by 5 and reflects 35% melee damage back.', multiplier: 0.35, secondaryBonus: 5 },
    { level: 3, cost: 110, name: 'Spiked Bulwark III', description: 'Reduces incoming damage by 7 and reflects 45% melee damage back.', multiplier: 0.45, secondaryBonus: 7 },
    { level: 4, cost: 160, name: 'Spiked Bulwark IV', description: 'Reduces incoming damage by 10 and reflects 55% melee damage back.', multiplier: 0.55, secondaryBonus: 10 },
    { level: 5, cost: 220, name: 'Spiked Bulwark V', description: 'Reduces incoming damage by 13 and reflects 65% melee damage back.', multiplier: 0.65, secondaryBonus: 13 },
    { level: 6, cost: 290, name: 'Spiked Bulwark VI', description: 'Reduces incoming damage by 16 and reflects 75% melee damage back.', multiplier: 0.75, secondaryBonus: 16 },
    { level: 7, cost: 370, name: 'Spiked Bulwark VII', description: 'Reduces incoming damage by 19 and reflects 85% melee damage back.', multiplier: 0.85, secondaryBonus: 19 },
    { level: 8, cost: 460, name: 'Spiked Bulwark VIII', description: 'Reduces incoming damage by 22 and reflects 95% melee damage back.', multiplier: 0.95, secondaryBonus: 22 },
    { level: 9, cost: 560, name: 'Spiked Bulwark IX', description: 'Reduces incoming damage by 26 and reflects 110% melee damage back.', multiplier: 1.10, secondaryBonus: 26 },
    { level: 10, cost: 680, name: 'Spiked Bulwark X - Dreadnought Carapace', description: 'Reduces incoming damage by 30 and reflects 130% melee damage back!', multiplier: 1.30, secondaryBonus: 30 }
  ] as EvoAbilityTier[]
};

export const ARCHER_ABILITIES = {
  multishot: [
    { level: 1, cost: 40, name: 'Multishot I', description: '30% chance to fire arrows at 2 targets simultaneously.', chance: 0.30, targets: 2 },
    { level: 2, cost: 70, name: 'Multishot II', description: '50% chance to fire arrows at 2 targets simultaneously.', chance: 0.50, targets: 2 },
    { level: 3, cost: 110, name: 'Multishot III', description: '70% chance to fire arrows at 2 targets simultaneously.', chance: 0.70, targets: 2 },
    { level: 4, cost: 160, name: 'Multishot IV', description: '45% chance to fire arrows at 3 targets simultaneously.', chance: 0.45, targets: 3 },
    { level: 5, cost: 220, name: 'Multishot V', description: '65% chance to fire arrows at 3 targets simultaneously.', chance: 0.65, targets: 3 },
    { level: 6, cost: 290, name: 'Multishot VI', description: '85% chance to fire arrows at 3 targets simultaneously.', chance: 0.85, targets: 3 },
    { level: 7, cost: 370, name: 'Multishot VII', description: '60% chance to fire arrows at 4 targets simultaneously.', chance: 0.60, targets: 4 },
    { level: 8, cost: 460, name: 'Multishot VIII', description: '80% chance to fire arrows at 4 targets simultaneously.', chance: 0.80, targets: 4 },
    { level: 9, cost: 560, name: 'Multishot IX', description: '70% chance to fire arrows at 5 targets simultaneously.', chance: 0.70, targets: 5 },
    { level: 10, cost: 680, name: 'Multishot X - Arrow Tempest', description: '90% chance to fire arrows at 5 targets simultaneously!', chance: 0.90, targets: 5 }
  ] as EvoAbilityTier[],
  damageAura: [
    { level: 1, cost: 40, name: 'Damage Aura I', description: 'Radiates +6 Attack to all surrounding allies in combat.', bonus: 6 },
    { level: 2, cost: 70, name: 'Damage Aura II', description: 'Radiates +14 Attack to all surrounding allies in combat.', bonus: 14 },
    { level: 3, cost: 110, name: 'Damage Aura III', description: 'Radiates +24 Attack to all surrounding allies in combat.', bonus: 24 },
    { level: 4, cost: 160, name: 'Damage Aura IV', description: 'Radiates +36 Attack to all surrounding allies in combat.', bonus: 36 },
    { level: 5, cost: 220, name: 'Damage Aura V', description: 'Radiates +50 Attack to all surrounding allies in combat.', bonus: 50 },
    { level: 6, cost: 290, name: 'Damage Aura VI', description: 'Radiates +66 Attack to all surrounding allies in combat.', bonus: 66 },
    { level: 7, cost: 370, name: 'Damage Aura VII', description: 'Radiates +85 Attack to all surrounding allies in combat.', bonus: 85 },
    { level: 8, cost: 460, name: 'Damage Aura VIII', description: 'Radiates +106 Attack to all surrounding allies in combat.', bonus: 106 },
    { level: 9, cost: 560, name: 'Damage Aura IX', description: 'Radiates +130 Attack to all surrounding allies in combat.', bonus: 130 },
    { level: 10, cost: 680, name: 'Damage Aura X - Sovereign Might', description: 'Radiates +160 Attack to all surrounding allies in combat!', bonus: 160 }
  ] as EvoAbilityTier[],
  armorShred: [
    { level: 1, cost: 40, name: 'Sundering Shot I', description: 'Attacks shred 3 enemy Armor for 4.0s (benefits all allies!).', bonus: 3, duration: 4.0 },
    { level: 2, cost: 70, name: 'Sundering Shot II', description: 'Attacks shred 5 enemy Armor for 4.0s.', bonus: 5, duration: 4.0 },
    { level: 3, cost: 110, name: 'Sundering Shot III', description: 'Attacks shred 7 enemy Armor for 4.0s.', bonus: 7, duration: 4.0 },
    { level: 4, cost: 160, name: 'Sundering Shot IV', description: 'Attacks shred 10 enemy Armor for 4.0s.', bonus: 10, duration: 4.0 },
    { level: 5, cost: 220, name: 'Sundering Shot V', description: 'Attacks shred 13 enemy Armor for 4.0s.', bonus: 13, duration: 4.0 },
    { level: 6, cost: 290, name: 'Sundering Shot VI', description: 'Attacks shred 16 enemy Armor for 4.0s.', bonus: 16, duration: 4.0 },
    { level: 7, cost: 370, name: 'Sundering Shot VII', description: 'Attacks shred 19 enemy Armor for 4.0s.', bonus: 19, duration: 4.0 },
    { level: 8, cost: 460, name: 'Sundering Shot VIII', description: 'Attacks shred 22 enemy Armor for 4.0s.', bonus: 22, duration: 4.0 },
    { level: 9, cost: 560, name: 'Sundering Shot IX', description: 'Attacks shred 26 enemy Armor for 4.0s.', bonus: 26, duration: 4.0 },
    { level: 10, cost: 680, name: 'Sundering Shot X - Armor Breaker', description: 'Attacks shred 30 enemy Armor for 4.0s!', bonus: 30, duration: 4.0 }
  ] as EvoAbilityTier[],
  rapidQuiver: [
    { level: 1, cost: 40, name: 'Rapid Quiver I', description: 'Increases attack speed by +15% (0.74s attack rate).', bonus: 0.15 },
    { level: 2, cost: 70, name: 'Rapid Quiver II', description: 'Increases attack speed by +22% (0.70s attack rate).', bonus: 0.22 },
    { level: 3, cost: 110, name: 'Rapid Quiver III', description: 'Increases attack speed by +30% (0.65s attack rate).', bonus: 0.30 },
    { level: 4, cost: 160, name: 'Rapid Quiver IV', description: 'Increases attack speed by +40% (0.61s attack rate).', bonus: 0.40 },
    { level: 5, cost: 220, name: 'Rapid Quiver V', description: 'Increases attack speed by +50% (0.57s attack rate).', bonus: 0.50 },
    { level: 6, cost: 290, name: 'Rapid Quiver VI', description: 'Increases attack speed by +60% (0.53s attack rate).', bonus: 0.60 },
    { level: 7, cost: 370, name: 'Rapid Quiver VII', description: 'Increases attack speed by +70% (0.50s attack rate).', bonus: 0.70 },
    { level: 8, cost: 460, name: 'Rapid Quiver VIII', description: 'Increases attack speed by +80% (0.47s attack rate).', bonus: 0.80 },
    { level: 9, cost: 560, name: 'Rapid Quiver IX', description: 'Increases attack speed by +90% (0.45s attack rate).', bonus: 0.90 },
    { level: 10, cost: 680, name: 'Rapid Quiver X - Windrunner Flurry', description: 'Increases attack speed by +105% (0.41s relentless flurry)!', bonus: 1.05 }
  ] as EvoAbilityTier[]
};

export const MAGE_ABILITIES = {
  manaGain: [
    { level: 1, cost: 40, name: 'Arcane Siphon I', description: 'Generates +25 Mana per attack (Fireball every 4 attacks).', bonus: 25 },
    { level: 2, cost: 70, name: 'Arcane Siphon II', description: 'Generates +34 Mana per attack (Fireball every 3 attacks).', bonus: 34 },
    { level: 3, cost: 110, name: 'Arcane Siphon III', description: 'Generates +50 Mana per attack (Fireball every 2 attacks!).', bonus: 50 },
    { level: 4, cost: 160, name: 'Arcane Siphon IV', description: 'Generates +60 Mana per attack.', bonus: 60 },
    { level: 5, cost: 220, name: 'Arcane Siphon V', description: 'Generates +75 Mana per attack.', bonus: 75 },
    { level: 6, cost: 290, name: 'Arcane Siphon VI', description: 'Generates +90 Mana per attack.', bonus: 90 },
    { level: 7, cost: 370, name: 'Arcane Siphon VII', description: 'Generates +100 Mana per attack (Fireball every single attack!).', bonus: 100 },
    { level: 8, cost: 460, name: 'Arcane Siphon VIII', description: 'Generates +120 Mana per attack.', bonus: 120 },
    { level: 9, cost: 560, name: 'Arcane Siphon IX', description: 'Generates +140 Mana per attack.', bonus: 140 },
    { level: 10, cost: 680, name: 'Arcane Siphon X - Leyline Font', description: 'Generates +160 Mana per attack (Instant catastrophic recharge!).', bonus: 160 }
  ] as EvoAbilityTier[],
  fireball: [
    { level: 1, cost: 40, name: 'Mega Fireball I', description: 'Full mana casts AoE Fireball dealing 2.2x Attack damage across a 2.4m radius.', multiplier: 2.2, bonus: 2.4 },
    { level: 2, cost: 70, name: 'Mega Fireball II', description: 'Full mana casts AoE Fireball dealing 3.0x Attack damage across a 2.8m radius.', multiplier: 3.0, bonus: 2.8 },
    { level: 3, cost: 110, name: 'Mega Fireball III', description: 'Full mana casts AoE Fireball dealing 3.8x Attack damage across a 3.2m radius.', multiplier: 3.8, bonus: 3.2 },
    { level: 4, cost: 160, name: 'Mega Fireball IV', description: 'Full mana casts AoE Fireball dealing 4.8x Attack damage across a 3.6m radius.', multiplier: 4.8, bonus: 3.6 },
    { level: 5, cost: 220, name: 'Mega Fireball V', description: 'Full mana casts AoE Fireball dealing 6.0x Attack damage across a 4.0m radius.', multiplier: 6.0, bonus: 4.0 },
    { level: 6, cost: 290, name: 'Mega Fireball VI', description: 'Full mana casts AoE Fireball dealing 7.4x Attack damage across a 4.4m radius.', multiplier: 7.4, bonus: 4.4 },
    { level: 7, cost: 370, name: 'Mega Fireball VII', description: 'Full mana casts AoE Fireball dealing 9.0x Attack damage across a 4.8m radius.', multiplier: 9.0, bonus: 4.8 },
    { level: 8, cost: 460, name: 'Mega Fireball VIII', description: 'Full mana casts AoE Fireball dealing 11.0x Attack damage across a 5.2m radius.', multiplier: 11.0, bonus: 5.2 },
    { level: 9, cost: 560, name: 'Mega Fireball IX', description: 'Full mana casts AoE Fireball dealing 13.5x Attack damage across a 5.6m radius.', multiplier: 13.5, bonus: 5.6 },
    { level: 10, cost: 680, name: 'Mega Fireball X - Hellfire Nova', description: 'Full mana casts AoE Fireball dealing 16.5x Attack damage across a 6.2m inferno radius!', multiplier: 16.5, bonus: 6.2 }
  ] as EvoAbilityTier[],
  stun: [
    { level: 1, cost: 40, name: 'Paralyzing Arc I', description: '25% chance to stun target for 1.2s with a crackling lightning jolt.', chance: 0.25, duration: 1.2 },
    { level: 2, cost: 70, name: 'Paralyzing Arc II', description: '30% chance to stun target for 1.4s.', chance: 0.30, duration: 1.4 },
    { level: 3, cost: 110, name: 'Paralyzing Arc III', description: '35% chance to stun target for 1.6s.', chance: 0.35, duration: 1.6 },
    { level: 4, cost: 160, name: 'Paralyzing Arc IV', description: '40% chance to stun target for 1.8s.', chance: 0.40, duration: 1.8 },
    { level: 5, cost: 220, name: 'Paralyzing Arc V', description: '45% chance to stun target for 2.0s.', chance: 0.45, duration: 2.0 },
    { level: 6, cost: 290, name: 'Paralyzing Arc VI', description: '50% chance to stun target for 2.2s.', chance: 0.50, duration: 2.2 },
    { level: 7, cost: 370, name: 'Paralyzing Arc VII', description: '55% chance to stun target for 2.4s.', chance: 0.55, duration: 2.4 },
    { level: 8, cost: 460, name: 'Paralyzing Arc VIII', description: '60% chance to stun target for 2.6s.', chance: 0.60, duration: 2.6 },
    { level: 9, cost: 560, name: 'Paralyzing Arc IX', description: '65% chance to stun target for 2.8s.', chance: 0.65, duration: 2.8 },
    { level: 10, cost: 680, name: 'Paralyzing Arc X - Temporal Stasis', description: '75% chance to stun target for 3.2s (halts movement, attacks & boss abilities)!', chance: 0.75, duration: 3.2 }
  ] as EvoAbilityTier[],
  burn: [
    { level: 1, cost: 40, name: 'Molten Pyre I', description: 'Attacks & fireballs ignite enemies for 30% Attack power/sec over 3.0s.', multiplier: 0.30, duration: 3.0 },
    { level: 2, cost: 70, name: 'Molten Pyre II', description: 'Attacks ignite enemies for 45% Attack power/sec over 3.0s.', multiplier: 0.45, duration: 3.0 },
    { level: 3, cost: 110, name: 'Molten Pyre III', description: 'Attacks ignite enemies for 60% Attack power/sec over 3.0s.', multiplier: 0.60, duration: 3.0 },
    { level: 4, cost: 160, name: 'Molten Pyre IV', description: 'Attacks ignite enemies for 75% Attack power/sec over 3.0s.', multiplier: 0.75, duration: 3.0 },
    { level: 5, cost: 220, name: 'Molten Pyre V', description: 'Attacks ignite enemies for 95% Attack power/sec over 3.0s.', multiplier: 0.95, duration: 3.0 },
    { level: 6, cost: 290, name: 'Molten Pyre VI', description: 'Attacks ignite enemies for 115% Attack power/sec over 3.0s.', multiplier: 1.15, duration: 3.0 },
    { level: 7, cost: 370, name: 'Molten Pyre VII', description: 'Attacks ignite enemies for 135% Attack power/sec over 3.0s.', multiplier: 1.35, duration: 3.0 },
    { level: 8, cost: 460, name: 'Molten Pyre VIII', description: 'Attacks ignite enemies for 155% Attack power/sec over 3.0s.', multiplier: 1.55, duration: 3.0 },
    { level: 9, cost: 560, name: 'Molten Pyre IX', description: 'Attacks ignite enemies for 180% Attack power/sec over 3.0s.', multiplier: 1.80, duration: 3.0 },
    { level: 10, cost: 680, name: 'Molten Pyre X - Hellfire Inferno', description: 'Attacks ignite enemies for 210% Attack power/sec over 3.0s!', multiplier: 2.10, duration: 3.0 }
  ] as EvoAbilityTier[]
};

export const TOWER_DEFINITIONS: Record<TowerType, TowerDef> = {
  [TowerType.SHRINE]: {
    type: TowerType.SHRINE,
    name: 'Vitality Shrine',
    cost: 10,
    description: 'Heals friendly units (+1 HP) as they pass by.',
    color: 0x22c55e, // Emerald Green
    accentColor: 0x86efac,
    range: 3.5,
    rate: 1.0,
    healAmount: 1,
    branchA: [
      {
        name: 'Radiant Sanctuary I',
        cost: 25,
        badge: 'Burst Heal',
        description: 'Increases instant healing to +4 HP per hit.',
        range: 3.8,
        rate: 0.90,
        healAmount: 4
      },
      {
        name: 'Radiant Sanctuary II',
        cost: 50,
        badge: 'Burst Heal',
        description: 'Increases instant healing to +10 HP per hit.',
        range: 4.0,
        rate: 0.85,
        healAmount: 10
      },
      {
        name: 'Radiant Sanctuary III',
        cost: 85,
        badge: 'Burst Heal',
        description: 'Master healing font: +18 HP burst healing per hit.',
        range: 4.2,
        rate: 0.80,
        healAmount: 18
      },
      {
        name: 'Radiant Sanctuary IV',
        cost: 130,
        badge: 'Burst Heal',
        description: 'Divine warmth: +28 HP burst healing per hit.',
        range: 4.3,
        rate: 0.75,
        healAmount: 28
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
        description: 'Blissful aura: +55 HP burst healing per hit.',
        range: 4.5,
        rate: 0.65,
        healAmount: 55
      },
      {
        name: 'Radiant Sanctuary VII',
        cost: 310,
        badge: 'Burst Heal',
        description: 'Angelic fountain: +72 HP burst healing per hit.',
        range: 4.6,
        rate: 0.60,
        healAmount: 72
      },
      {
        name: 'Radiant Sanctuary VIII',
        cost: 390,
        badge: 'Burst Heal',
        description: 'Seraphic beacon: +92 HP burst healing per hit.',
        range: 4.7,
        rate: 0.55,
        healAmount: 92
      },
      {
        name: 'Radiant Sanctuary IX',
        cost: 480,
        badge: 'Burst Heal',
        description: 'Immortal reservoir: +115 HP burst healing per hit.',
        range: 4.8,
        rate: 0.50,
        healAmount: 115
      },
      {
        name: 'Radiant Sanctuary X - Divine Avatar',
        cost: 600,
        badge: 'Burst Heal',
        description: 'Avatar of Life: massive +145 HP burst healing per hit at rapid 0.45s pulse!',
        range: 5.0,
        rate: 0.45,
        healAmount: 145
      }
    ],
    branchB: [
      {
        name: 'Lifebloom Grove I',
        cost: 20,
        badge: 'Slow Stacking',
        description: 'Heals +1 HP on hit (base), grants Lifebloom: +5 Max HP round bonus per stack.',
        range: 3.5,
        rate: 1.0,
        healAmount: 1,
        stackingHpPerRound: 5
      },
      {
        name: 'Lifebloom Grove II',
        cost: 45,
        badge: 'Slow Stacking',
        description: 'Heals +2 HP on hit, grants Lifebloom: +10 Max HP round bonus per stack.',
        range: 3.6,
        rate: 1.0,
        healAmount: 2,
        stackingHpPerRound: 10
      },
      {
        name: 'Lifebloom Grove III',
        cost: 75,
        badge: 'Slow Stacking',
        description: 'Heals +3 HP on hit, grants Lifebloom: +16 Max HP round bonus per stack.',
        range: 3.6,
        rate: 0.98,
        healAmount: 3,
        stackingHpPerRound: 16
      },
      {
        name: 'Lifebloom Grove IV',
        cost: 115,
        badge: 'Slow Stacking',
        description: 'Heals +4 HP on hit, grants Lifebloom: +24 Max HP round bonus per stack.',
        range: 3.7,
        rate: 0.96,
        healAmount: 4,
        stackingHpPerRound: 24
      },
      {
        name: 'Lifebloom Grove V',
        cost: 165,
        badge: 'Slow Stacking',
        description: 'Heals +6 HP on hit, grants Lifebloom: +34 Max HP round bonus per stack.',
        range: 3.7,
        rate: 0.94,
        healAmount: 6,
        stackingHpPerRound: 34
      },
      {
        name: 'Lifebloom Grove VI',
        cost: 225,
        badge: 'Slow Stacking',
        description: 'Heals +8 HP on hit, grants Lifebloom: +46 Max HP round bonus per stack.',
        range: 3.8,
        rate: 0.92,
        healAmount: 8,
        stackingHpPerRound: 46
      },
      {
        name: 'Lifebloom Grove VII',
        cost: 295,
        badge: 'Slow Stacking',
        description: 'Heals +11 HP on hit, grants Lifebloom: +60 Max HP round bonus per stack.',
        range: 3.8,
        rate: 0.90,
        healAmount: 11,
        stackingHpPerRound: 60
      },
      {
        name: 'Lifebloom Grove VIII',
        cost: 375,
        badge: 'Slow Stacking',
        description: 'Heals +15 HP on hit, grants Lifebloom: +78 Max HP round bonus per stack.',
        range: 3.9,
        rate: 0.88,
        healAmount: 15,
        stackingHpPerRound: 78
      },
      {
        name: 'Lifebloom Grove IX',
        cost: 465,
        badge: 'Slow Stacking',
        description: 'Heals +20 HP on hit, grants Lifebloom: +100 Max HP round bonus per stack.',
        range: 3.9,
        rate: 0.85,
        healAmount: 20,
        stackingHpPerRound: 100
      },
      {
        name: 'Lifebloom Grove X - Yggdrasil Heart',
        cost: 580,
        badge: 'Slow Stacking',
        description: 'Heart of Yggdrasil: heals +26 HP on hit, +130 Max HP round bonus per stack!',
        range: 4.0,
        rate: 0.80,
        healAmount: 26,
        stackingHpPerRound: 130
      }
    ]
  },

  [TowerType.FORGE]: {
    type: TowerType.FORGE,
    name: 'Iron Forge',
    cost: 20,
    description: 'Forges armor plating on passing units (+1 Armor), mitigating physical damage.',
    color: 0x64748b, // Slate Steel
    accentColor: 0x38bdf8,
    range: 3.2,
    rate: 1.2,
    armorAmount: 1,
    branchA: [
      {
        name: 'Reinforced Anvil I',
        cost: 30,
        badge: 'Heavy Plating',
        description: 'Forges +3 Armor per hit.',
        range: 3.4,
        rate: 1.15,
        armorAmount: 3
      },
      {
        name: 'Reinforced Anvil II',
        cost: 60,
        badge: 'Heavy Plating',
        description: 'Heavy forging: +6 Armor per hit.',
        range: 3.5,
        rate: 1.10,
        armorAmount: 6
      },
      {
        name: 'Reinforced Anvil III',
        cost: 95,
        badge: 'Heavy Plating',
        description: 'Hardened steel: +11 Armor per hit.',
        range: 3.6,
        rate: 1.05,
        armorAmount: 11
      },
      {
        name: 'Reinforced Anvil IV',
        cost: 140,
        badge: 'Heavy Plating',
        description: 'Mithril weave: +18 Armor per hit.',
        range: 3.7,
        rate: 1.00,
        armorAmount: 18
      },
      {
        name: 'Reinforced Anvil V',
        cost: 195,
        badge: 'Heavy Plating',
        description: 'Dragonscale coat: +27 Armor per hit.',
        range: 3.8,
        rate: 0.95,
        armorAmount: 27
      },
      {
        name: 'Reinforced Anvil VI',
        cost: 260,
        badge: 'Heavy Plating',
        description: 'Obsidian shell: +38 Armor per hit.',
        range: 3.9,
        rate: 0.90,
        armorAmount: 38
      },
      {
        name: 'Reinforced Anvil VII',
        cost: 335,
        badge: 'Heavy Plating',
        description: 'Titanium plating: +51 Armor per hit.',
        range: 4.0,
        rate: 0.85,
        armorAmount: 51
      },
      {
        name: 'Reinforced Anvil VIII',
        cost: 420,
        badge: 'Heavy Plating',
        description: 'Adamantine cuirass: +66 Armor per hit.',
        range: 4.1,
        rate: 0.80,
        armorAmount: 66
      },
      {
        name: 'Reinforced Anvil IX',
        cost: 520,
        badge: 'Heavy Plating',
        description: 'Ethereal bulwark: +84 Armor per hit.',
        range: 4.2,
        rate: 0.75,
        armorAmount: 84
      },
      {
        name: 'Reinforced Anvil X - Adamant Bastion',
        cost: 650,
        badge: 'Heavy Plating',
        description: 'Adamant Bastion: massive +105 Armor per hit at rapid 0.70s strike!',
        range: 4.4,
        rate: 0.70,
        armorAmount: 105
      }
    ],
    branchB: [
      {
        name: 'Tempered Bastion I',
        cost: 25,
        badge: 'Slow Stacking',
        description: 'Grants +1 Armor on hit (base), +3 bonus Armor round end per stack.',
        range: 3.2,
        rate: 1.20,
        armorAmount: 1,
        stackingArmorPerRound: 3
      },
      {
        name: 'Tempered Bastion II',
        cost: 50,
        badge: 'Slow Stacking',
        description: 'Grants +2 Armor on hit, +6 bonus Armor round end per stack.',
        range: 3.3,
        rate: 1.18,
        armorAmount: 2,
        stackingArmorPerRound: 6
      },
      {
        name: 'Tempered Bastion III',
        cost: 80,
        badge: 'Slow Stacking',
        description: 'Grants +2 Armor on hit, +10 bonus Armor round end per stack.',
        range: 3.4,
        rate: 1.15,
        armorAmount: 2,
        stackingArmorPerRound: 10
      },
      {
        name: 'Tempered Bastion IV',
        cost: 120,
        badge: 'Slow Stacking',
        description: 'Grants +3 Armor on hit, +15 bonus Armor round end per stack.',
        range: 3.4,
        rate: 1.12,
        armorAmount: 3,
        stackingArmorPerRound: 15
      },
      {
        name: 'Tempered Bastion V',
        cost: 170,
        badge: 'Slow Stacking',
        description: 'Grants +4 Armor on hit, +21 bonus Armor round end per stack.',
        range: 3.5,
        rate: 1.10,
        armorAmount: 4,
        stackingArmorPerRound: 21
      },
      {
        name: 'Tempered Bastion VI',
        cost: 230,
        badge: 'Slow Stacking',
        description: 'Grants +5 Armor on hit, +28 bonus Armor round end per stack.',
        range: 3.5,
        rate: 1.05,
        armorAmount: 5,
        stackingArmorPerRound: 28
      },
      {
        name: 'Tempered Bastion VII',
        cost: 300,
        badge: 'Slow Stacking',
        description: 'Grants +7 Armor on hit, +37 bonus Armor round end per stack.',
        range: 3.6,
        rate: 1.00,
        armorAmount: 7,
        stackingArmorPerRound: 37
      },
      {
        name: 'Tempered Bastion VIII',
        cost: 380,
        badge: 'Slow Stacking',
        description: 'Grants +9 Armor on hit, +48 bonus Armor round end per stack.',
        range: 3.7,
        rate: 0.95,
        armorAmount: 9,
        stackingArmorPerRound: 48
      },
      {
        name: 'Tempered Bastion IX',
        cost: 470,
        badge: 'Slow Stacking',
        description: 'Grants +12 Armor on hit, +61 bonus Armor round end per stack.',
        range: 3.7,
        rate: 0.90,
        armorAmount: 12,
        stackingArmorPerRound: 61
      },
      {
        name: 'Tempered Bastion X - Eternal Fortress',
        cost: 580,
        badge: 'Slow Stacking',
        description: 'Eternal Fortress: +16 Armor on hit, +78 bonus Armor round end per stack!',
        range: 3.8,
        rate: 0.85,
        armorAmount: 16,
        stackingArmorPerRound: 78
      }
    ]
  },

  [TowerType.OBELISK]: {
    type: TowerType.OBELISK,
    name: 'Flame Obelisk',
    cost: 20,
    description: 'Infuses weapons with flame, increasing unit attack damage (+1 Attack).',
    color: 0xf97316, // Fire Orange
    accentColor: 0xfde047,
    range: 3.5,
    rate: 1.1,
    attackAmount: 1,
    branchA: [
      {
        name: 'War Pillar I',
        cost: 30,
        badge: 'High Impact',
        description: 'Infuses +4 Attack damage per hit.',
        range: 3.6,
        rate: 1.05,
        attackAmount: 4
      },
      {
        name: 'War Pillar II',
        cost: 60,
        badge: 'High Impact',
        description: 'Blazing edge: +8 Attack damage per hit.',
        range: 3.7,
        rate: 1.00,
        attackAmount: 8
      },
      {
        name: 'War Pillar III',
        cost: 95,
        badge: 'High Impact',
        description: 'Scorching strike: +14 Attack damage per hit.',
        range: 3.8,
        rate: 0.95,
        attackAmount: 14
      },
      {
        name: 'War Pillar IV',
        cost: 140,
        badge: 'High Impact',
        description: 'Ignited edge: +22 Attack damage per hit.',
        range: 3.9,
        rate: 0.90,
        attackAmount: 22
      },
      {
        name: 'War Pillar V',
        cost: 195,
        badge: 'High Impact',
        description: 'Searing heat: +32 Attack damage per hit.',
        range: 4.0,
        rate: 0.85,
        attackAmount: 32
      },
      {
        name: 'War Pillar VI',
        cost: 260,
        badge: 'High Impact',
        description: 'Volcanic thrust: +44 Attack damage per hit.',
        range: 4.1,
        rate: 0.80,
        attackAmount: 44
      },
      {
        name: 'War Pillar VII',
        cost: 335,
        badge: 'High Impact',
        description: 'Inferno blade: +58 Attack damage per hit.',
        range: 4.2,
        rate: 0.75,
        attackAmount: 58
      },
      {
        name: 'War Pillar VIII',
        cost: 420,
        badge: 'High Impact',
        description: 'Pyre wrath: +75 Attack damage per hit.',
        range: 4.3,
        rate: 0.70,
        attackAmount: 75
      },
      {
        name: 'War Pillar IX',
        cost: 520,
        badge: 'High Impact',
        description: 'Solar conflagration: +95 Attack damage per hit.',
        range: 4.4,
        rate: 0.65,
        attackAmount: 95
      },
      {
        name: 'War Pillar X - Inferno Sovereign',
        cost: 650,
        badge: 'High Impact',
        description: 'Inferno Sovereign: colossal +120 Attack damage per hit at rapid 0.60s strike!',
        range: 4.6,
        rate: 0.60,
        attackAmount: 120
      }
    ],
    branchB: [
      {
        name: 'Frenzy Monolith I',
        cost: 25,
        badge: 'Slow Stacking',
        description: 'Grants +1 Attack on hit (base), +3 bonus Attack round end per stack.',
        range: 3.5,
        rate: 1.10,
        attackAmount: 1,
        stackingAttackPerRound: 3
      },
      {
        name: 'Frenzy Monolith II',
        cost: 50,
        badge: 'Slow Stacking',
        description: 'Grants +2 Attack on hit, +6 bonus Attack round end per stack.',
        range: 3.5,
        rate: 1.08,
        attackAmount: 2,
        stackingAttackPerRound: 6
      },
      {
        name: 'Frenzy Monolith III',
        cost: 80,
        badge: 'Slow Stacking',
        description: 'Grants +2 Attack on hit, +10 bonus Attack round end per stack.',
        range: 3.6,
        rate: 1.05,
        attackAmount: 2,
        stackingAttackPerRound: 10
      },
      {
        name: 'Frenzy Monolith IV',
        cost: 120,
        badge: 'Slow Stacking',
        description: 'Grants +3 Attack on hit, +15 bonus Attack round end per stack.',
        range: 3.6,
        rate: 1.02,
        attackAmount: 3,
        stackingAttackPerRound: 15
      },
      {
        name: 'Frenzy Monolith V',
        cost: 170,
        badge: 'Slow Stacking',
        description: 'Grants +4 Attack on hit, +21 bonus Attack round end per stack.',
        range: 3.7,
        rate: 1.00,
        attackAmount: 4,
        stackingAttackPerRound: 21
      },
      {
        name: 'Frenzy Monolith VI',
        cost: 230,
        badge: 'Slow Stacking',
        description: 'Grants +5 Attack on hit, +28 bonus Attack round end per stack.',
        range: 3.7,
        rate: 0.96,
        attackAmount: 5,
        stackingAttackPerRound: 28
      },
      {
        name: 'Frenzy Monolith VII',
        cost: 300,
        badge: 'Slow Stacking',
        description: 'Grants +7 Attack on hit, +37 bonus Attack round end per stack.',
        range: 3.8,
        rate: 0.92,
        attackAmount: 7,
        stackingAttackPerRound: 37
      },
      {
        name: 'Frenzy Monolith VIII',
        cost: 380,
        badge: 'Slow Stacking',
        description: 'Grants +9 Attack on hit, +48 bonus Attack round end per stack.',
        range: 3.8,
        rate: 0.88,
        attackAmount: 9,
        stackingAttackPerRound: 48
      },
      {
        name: 'Frenzy Monolith IX',
        cost: 470,
        badge: 'Slow Stacking',
        description: 'Grants +12 Attack on hit, +61 bonus Attack round end per stack.',
        range: 3.9,
        rate: 0.84,
        attackAmount: 12,
        stackingAttackPerRound: 61
      },
      {
        name: 'Frenzy Monolith X - Cataclysm Core',
        cost: 580,
        badge: 'Slow Stacking',
        description: 'Cataclysm Core: +16 Attack on hit, +78 bonus Attack round end per stack!',
        range: 4.0,
        rate: 0.80,
        attackAmount: 16,
        stackingAttackPerRound: 78
      }
    ]
  },

  [TowerType.AURA]: {
    type: TowerType.AURA,
    name: 'Aura Spire',
    cost: 50,
    description: 'Emits a haste field that increases the attack/cast speed of all towers in range (+35% haste).',
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
        auraSpeedBonus: 0.50
      },
      {
        name: 'Clockwork Overdrive II',
        cost: 95,
        badge: 'Hyper-Haste',
        description: 'Overcharged field: +70% attack speed to nearby towers.',
        range: 3.5,
        rate: 2.0,
        auraSpeedBonus: 0.70
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
        auraSpeedBonus: 1.60
      },
      {
        name: 'Clockwork Overdrive VI',
        cost: 335,
        badge: 'Hyper-Haste',
        description: 'Aetheric tachyon: +200% attack speed to nearby towers.',
        range: 3.9,
        rate: 2.0,
        auraSpeedBonus: 2.00
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
        auraSpeedBonus: 3.50
      },
      {
        name: 'Clockwork Overdrive X - Chrono Horizon',
        cost: 760,
        badge: 'Hyper-Haste',
        description: 'Chrono Horizon: titanic +420% attack speed acceleration to surrounding towers!',
        range: 4.4,
        rate: 2.0,
        auraSpeedBonus: 4.20
      }
    ],
    branchB: [
      {
        name: 'Expansive Resonance I',
        cost: 55,
        badge: 'Wide Field',
        description: 'Broadened aura zone (range 5.2) boosting all towers by +40% attack speed.',
        range: 5.2,
        rate: 2.0,
        auraSpeedBonus: 0.40
      },
      {
        name: 'Expansive Resonance II',
        cost: 90,
        badge: 'Wide Field',
        description: 'Expansive pulse (range 6.0) boosting all towers by +48% attack speed.',
        range: 6.0,
        rate: 2.0,
        auraSpeedBonus: 0.48
      },
      {
        name: 'Expansive Resonance III',
        cost: 130,
        badge: 'Wide Field',
        description: 'Harmonic beacon (range 6.8) boosting all towers by +58% attack speed.',
        range: 6.8,
        rate: 2.0,
        auraSpeedBonus: 0.58
      },
      {
        name: 'Expansive Resonance IV',
        cost: 180,
        badge: 'Wide Field',
        description: 'Grand resonance (range 7.5) boosting all towers by +70% attack speed.',
        range: 7.5,
        rate: 2.0,
        auraSpeedBonus: 0.70
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
        description: 'Leyline conduit (range 8.8) boosting all towers by +100% attack speed.',
        range: 8.8,
        rate: 2.0,
        auraSpeedBonus: 1.00
      },
      {
        name: 'Expansive Resonance VII',
        cost: 390,
        badge: 'Wide Field',
        description: 'Island harmonizer (range 9.4) boosting all towers by +118% attack speed.',
        range: 9.4,
        rate: 2.0,
        auraSpeedBonus: 1.18
      },
      {
        name: 'Expansive Resonance VIII',
        cost: 480,
        badge: 'Wide Field',
        description: 'Aetheric nexus (range 10.0) boosting all towers by +138% attack speed.',
        range: 10.0,
        rate: 2.0,
        auraSpeedBonus: 1.38
      },
      {
        name: 'Expansive Resonance IX',
        cost: 580,
        badge: 'Wide Field',
        description: 'Celestial grid (range 10.6) boosting all towers by +160% attack speed.',
        range: 10.6,
        rate: 2.0,
        auraSpeedBonus: 1.60
      },
      {
        name: 'Expansive Resonance X - Realm Beacon',
        cost: 700,
        badge: 'Wide Field',
        description: 'Realm Beacon: massive island-wide range (11.4 tiles) boosting all towers by +185% attack speed!',
        range: 11.4,
        rate: 2.0,
        auraSpeedBonus: 1.85
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
        description: 'Chills units with a 40% slow for 3.2s for increased buff exposure.',
        range: 3.9,
        rate: 1.35,
        slowPercent: 0.40,
        slowDuration: 3.2
      },
      {
        name: 'Deep Freeze II',
        cost: 75,
        badge: 'Maximum Dwell',
        description: 'Super-chills units with a 45% slow for 3.6s for increased buff exposure.',
        range: 4.0,
        rate: 1.30,
        slowPercent: 0.45,
        slowDuration: 3.6
      },
      {
        name: 'Deep Freeze III',
        cost: 115,
        badge: 'Maximum Dwell',
        description: 'Permafrost coating: 50% movement slow for 4.0s.',
        range: 4.1,
        rate: 1.25,
        slowPercent: 0.50,
        slowDuration: 4.0
      },
      {
        name: 'Deep Freeze IV',
        cost: 165,
        badge: 'Maximum Dwell',
        description: 'Glacial stasis: 55% movement slow for 4.4s.',
        range: 4.2,
        rate: 1.20,
        slowPercent: 0.55,
        slowDuration: 4.4
      },
      {
        name: 'Deep Freeze V',
        cost: 225,
        badge: 'Maximum Dwell',
        description: 'Cryo-lock: 60% movement slow for 4.8s.',
        range: 4.3,
        rate: 1.15,
        slowPercent: 0.60,
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
        description: 'Frost lock: 70% movement slow for 5.6s.',
        range: 4.5,
        rate: 1.05,
        slowPercent: 0.70,
        slowDuration: 5.6
      },
      {
        name: 'Deep Freeze VIII',
        cost: 465,
        badge: 'Maximum Dwell',
        description: 'Zero drift: 74% movement slow for 6.0s.',
        range: 4.6,
        rate: 1.00,
        slowPercent: 0.74,
        slowDuration: 6.0
      },
      {
        name: 'Deep Freeze IX',
        cost: 565,
        badge: 'Maximum Dwell',
        description: 'Sub-zero capture: 77% movement slow for 6.5s.',
        range: 4.7,
        rate: 0.95,
        slowPercent: 0.77,
        slowDuration: 6.5
      },
      {
        name: 'Deep Freeze X - Absolute Zero',
        cost: 680,
        badge: 'Maximum Dwell',
        description: 'Absolute Zero: maximum 80% movement freeze lasting 7.0s!',
        range: 4.8,
        rate: 0.90,
        slowPercent: 0.80,
        slowDuration: 7.0
      }
    ],
    branchB: [
      {
        name: 'Blizzard Zone I',
        cost: 40,
        badge: 'AoE Chill',
        description: 'Pulsing blizzard zone (range 4.6) chilling all units in range by 24%.',
        range: 4.6,
        rate: 1.25,
        slowPercent: 0.24,
        slowDuration: 3.0
      },
      {
        name: 'Blizzard Zone II',
        cost: 70,
        badge: 'AoE Chill',
        description: 'Expanded blizzard (range 5.2) chilling all units in range by 28%.',
        range: 5.2,
        rate: 1.20,
        slowPercent: 0.28,
        slowDuration: 3.2
      },
      {
        name: 'Blizzard Zone III',
        cost: 110,
        badge: 'AoE Chill',
        description: 'Howling gale (range 5.8) chilling all units in range by 32%.',
        range: 5.8,
        rate: 1.15,
        slowPercent: 0.32,
        slowDuration: 3.5
      },
      {
        name: 'Blizzard Zone IV',
        cost: 155,
        badge: 'AoE Chill',
        description: 'Frost vortex (range 6.4) chilling all units in range by 36%.',
        range: 6.4,
        rate: 1.10,
        slowPercent: 0.36,
        slowDuration: 3.8
      },
      {
        name: 'Blizzard Zone V',
        cost: 210,
        badge: 'AoE Chill',
        description: 'Freezing squall (range 7.0) chilling all units in range by 40%.',
        range: 7.0,
        rate: 1.05,
        slowPercent: 0.40,
        slowDuration: 4.1
      },
      {
        name: 'Blizzard Zone VI',
        cost: 275,
        badge: 'AoE Chill',
        description: 'Whiteout field (range 7.6) chilling all units in range by 44%.',
        range: 7.6,
        rate: 1.00,
        slowPercent: 0.44,
        slowDuration: 4.4
      },
      {
        name: 'Blizzard Zone VII',
        cost: 350,
        badge: 'AoE Chill',
        description: 'Glacial typhoon (range 8.2) chilling all units in range by 48%.',
        range: 8.2,
        rate: 0.95,
        slowPercent: 0.48,
        slowDuration: 4.7
      },
      {
        name: 'Blizzard Zone VIII',
        cost: 435,
        badge: 'AoE Chill',
        description: 'Cryo storm (range 8.8) chilling all units in range by 52%.',
        range: 8.8,
        rate: 0.90,
        slowPercent: 0.52,
        slowDuration: 5.0
      },
      {
        name: 'Blizzard Zone IX',
        cost: 530,
        badge: 'AoE Chill',
        description: 'Permafrost dome (range 9.4) chilling all units in range by 56%.',
        range: 9.4,
        rate: 0.85,
        slowPercent: 0.56,
        slowDuration: 5.3
      },
      {
        name: 'Blizzard Zone X - Glacial Vortex',
        cost: 640,
        badge: 'AoE Chill',
        description: 'Glacial Vortex: immense 10.2 tile tempest chilling all units by 60% (0.80s pulse)!',
        range: 10.2,
        rate: 0.80,
        slowPercent: 0.60,
        slowDuration: 5.8
      }
    ]
  },

  [TowerType.RULEBREAKER]: {
    type: TowerType.RULEBREAKER,
    name: 'The Rulebreaker',
    cost: 35,
    description: 'Rewrites unit reality, directly setting passing unit HP to a fixed 15 HP.',
    color: 0xe11d48, // Crimson Arcane
    accentColor: 0xf43f5e,
    range: 3.0,
    rate: 1.5,
    fixedHp: 15,
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
        description: 'Titanic leap: directly sets passing unit HP to 160 HP (slow 1.5s cast rate).',
        range: 3.1,
        rate: 1.5,
        fixedHp: 160
      },
      {
        name: 'Titan Core III - Colossus Forge',
        cost: 175,
        badge: 'Aggressive HP',
        description: 'Colossus Forge: sets unit HP to 250 HP cap (slow 1.5s cast rate)! Primes units for Tier 3 ascensions.',
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
        description: 'Accelerated shift: sets unit HP to 40 HP at hyper-speed 0.45s cast rate.',
        range: 3.0,
        rate: 0.45,
        fixedHp: 40
      },
      {
        name: 'Chrono Transmuter II',
        cost: 75,
        badge: 'Rapid Cast',
        description: 'Rapid transmuter: sets unit HP to 80 HP at hyper-speed 0.45s cast rate.',
        range: 3.1,
        rate: 0.45,
        fixedHp: 80
      },
      {
        name: 'Chrono Transmuter III',
        cost: 115,
        badge: 'Rapid Cast',
        description: 'High-speed reality warping: sets unit HP to 130 HP at hyper-speed 0.45s cast rate.',
        range: 3.2,
        rate: 0.45,
        fixedHp: 130
      },
      {
        name: 'Chrono Transmuter IV',
        cost: 165,
        badge: 'Rapid Cast',
        description: 'Blistering shift: sets unit HP to 190 HP at hyper-speed 0.45s cast rate.',
        range: 3.3,
        rate: 0.45,
        fixedHp: 190
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
        description: 'Generates +46 Gold every time it hits a passing unit.',
        range: 4.3,
        rate: 0.80,
        goldPerHit: 46
      },
      {
        name: 'Midas Siphon IX',
        cost: 520,
        badge: 'Gold on Hit',
        description: 'Generates +56 Gold every time it hits a passing unit.',
        range: 4.4,
        rate: 0.75,
        goldPerHit: 56
      },
      {
        name: 'Midas Siphon X - Philosopher Touch',
        cost: 630,
        badge: 'Gold on Hit',
        description: 'Philosopher Touch: generates +68 Gold on rapid strike (+68g every 0.70s)!',
        range: 4.5,
        rate: 0.70,
        goldPerHit: 68
      }
    ],
    branchB: [
      {
        name: 'Vault Reserve I',
        cost: 40,
        badge: 'Round Interest',
        description: 'Safeguards capital: yields 10% round interest (min 20g) at round end. No on-hit gold.',
        range: 3.3,
        rate: 1.25,
        roundInterestPercent: 0.10,
        roundFlatGold: 20
      },
      {
        name: 'Vault Reserve II',
        cost: 70,
        badge: 'Round Interest',
        description: 'Secure vaults: yields 14% round interest (min 35g) at round end. No on-hit gold.',
        range: 3.4,
        rate: 1.20,
        roundInterestPercent: 0.14,
        roundFlatGold: 35
      },
      {
        name: 'Vault Reserve III',
        cost: 110,
        badge: 'Round Interest',
        description: 'Fortified repository: yields 18% round interest (min 55g) at round end. No on-hit gold.',
        range: 3.5,
        rate: 1.18,
        roundInterestPercent: 0.18,
        roundFlatGold: 55
      },
      {
        name: 'Vault Reserve IV',
        cost: 160,
        badge: 'Round Interest',
        description: 'Treasury reserve: yields 22% round interest (min 80g) at round end. No on-hit gold.',
        range: 3.5,
        rate: 1.15,
        roundInterestPercent: 0.22,
        roundFlatGold: 80
      },
      {
        name: 'Vault Reserve V',
        cost: 220,
        badge: 'Round Interest',
        description: 'High-capital bank: yields 26% round interest (min 115g) at round end. No on-hit gold.',
        range: 3.6,
        rate: 1.12,
        roundInterestPercent: 0.26,
        roundFlatGold: 115
      },
      {
        name: 'Vault Reserve VI',
        cost: 290,
        badge: 'Round Interest',
        description: 'Guild bullion vault: yields 30% round interest (min 160g) at round end. No on-hit gold.',
        range: 3.6,
        rate: 1.10,
        roundInterestPercent: 0.30,
        roundFlatGold: 160
      },
      {
        name: 'Vault Reserve VII',
        cost: 370,
        badge: 'Round Interest',
        description: 'Royal exchange: yields 35% round interest (min 215g) at round end. No on-hit gold.',
        range: 3.7,
        rate: 1.05,
        roundInterestPercent: 0.35,
        roundFlatGold: 215
      },
      {
        name: 'Vault Reserve VIII',
        cost: 460,
        badge: 'Round Interest',
        description: 'Crown sovereign fund: yields 40% round interest (min 280g) at round end. No on-hit gold.',
        range: 3.7,
        rate: 1.00,
        roundInterestPercent: 0.40,
        roundFlatGold: 280
      },
      {
        name: 'Vault Reserve IX',
        cost: 560,
        badge: 'Round Interest',
        description: 'Monarch exchequer: yields 45% round interest (min 360g) at round end. No on-hit gold.',
        range: 3.8,
        rate: 0.95,
        roundInterestPercent: 0.45,
        roundFlatGold: 360
      },
      {
        name: 'Vault Reserve X - Imperial Treasury',
        cost: 680,
        badge: 'Round Interest',
        description: 'Imperial Treasury: yields 50% compound round interest (min 460g) at round end! No on-hit gold.',
        range: 3.8,
        rate: 0.90,
        roundInterestPercent: 0.50,
        roundFlatGold: 460
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
        description: 'Evolves 1 unit (at 250 HP) per wave into a Soldier (1,250 HP cap) with Armor Aura and Critical Strike.',
        range: 3.0,
        rate: 1.0
      }
    ],
    branchB: [
      {
        name: 'Archer Forge',
        cost: 0,
        badge: 'Ranged Marksman',
        description: 'Evolves 1 unit (at 250 HP) per wave into an Archer (1,000 HP cap) with Multishot and Damage Aura.',
        range: 3.0,
        rate: 1.0
      }
    ],
    branchC: [
      {
        name: 'Mage Sanctum',
        cost: 0,
        badge: 'Arcane Pyromancer',
        description: 'Evolves 1 unit (at 250 HP) per wave into a Mage (850 HP cap). Generates mana on attack, casting an explosive AoE Mega Fireball at full mana.',
        range: 3.0,
        rate: 1.0
      }
    ]
  }
};

