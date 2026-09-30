import confetti from 'canvas-confetti';
import { TowerType, UpgradeBranch, TOWER_DEFINITIONS, TowerDef, SOLDIER_ABILITIES, ARCHER_ABILITIES, MAGE_ABILITIES } from '../towers/TowerData';
import { TowerInstance, TowerManager, TargetPriority, TARGET_PRIORITIES, AUTO_TARGET_ORDER, hasTargetPriority } from '../towers/TowerManager';
import { Unit, UnitManager } from '../units/UnitManager';
import { FriendlyClass, EnemyClass, ENEMY_UNIT_STATS, getEnemyWaveScaling, armorReduction, getKillBounty } from '../units/UnitData';
import { CAMPAIGN_MISSIONS, CampaignMission } from '../campaign/CampaignData';
import { TechTreeManager } from '../campaign/TechTree';
import { audio } from '../engine/AudioSystem';
import { PortalGuardian } from '../towers/PortalGuardianManager';
import { AchievementManager } from '../achievements/AchievementManager';
import { ACHIEVEMENTS, AchievementCategory, AchievementDef, AchievementTierDef } from '../achievements/AchievementData';
import { MultiplayerModal } from './MultiplayerModal';
import { NetworkManager } from '../network/NetworkManager';
import { escapeHtml } from './html';

export class UIManager {
  public domContainer: HTMLElement;
  public towerManager!: TowerManager;
  public unitManager!: UnitManager;
  public techTree!: TechTreeManager;
  public achievementManager!: AchievementManager;

  // Multiplayer
  public multiplayerModal!: MultiplayerModal;
  public networkManager?: NetworkManager;
  public currentTowerCardIsOwner: boolean = true;

  // Placement state
  public selectedTowerTypeForPlacement: TowerType | null = null;

  // Callbacks to main game loop
  public onStartWave: () => void = () => {};
  public onBuyRecruit: () => void = () => {};
  public onSetGameSpeed: (speed: number) => void = () => {};
  public onSelectMission: (mission: CampaignMission) => void = () => {};
  public onSelectTowerPlacement: (type: TowerType | null) => void = () => {};
  public onToggleFocusFire: () => void = () => {};
  public onClearFocusTarget: () => void = () => {};
  public onToggleSmartFocus: () => void = () => {};
  public onSetTargetPriority: (towerId: number, priority: TargetPriority) => void = () => {};

  // Elements
  private topBarEl!: HTMLElement;
  private towerPaletteEl!: HTMLElement;
  private towerCardEl!: HTMLElement;
  private unitCardEl!: HTMLElement;
  private campaignModalEl!: HTMLElement;
  private techModalEl!: HTMLElement;
  private victoryModalEl!: HTMLElement;
  private defeatModalEl!: HTMLElement;
  public grandBossBarEl!: HTMLElement;
  public waveIntelModalEl!: HTMLElement;
  public tutorialModalEl!: HTMLElement;
  private guardianCardEl!: HTMLElement;
  public focusBannerEl!: HTMLElement;
  public trophiesModalEl!: HTMLElement;
  public achievementToastEl!: HTMLElement;

  public currentMission: CampaignMission | null = null;
  public currentWave: number = 1;

  constructor(domContainer: HTMLElement) {
    this.domContainer = domContainer;
    this.createUIElements();
  }

  init(towerManager: TowerManager, unitManager: UnitManager, techTree: TechTreeManager, achievementManager: AchievementManager) {
    this.towerManager = towerManager;
    this.unitManager = unitManager;
    this.techTree = techTree;
    this.achievementManager = achievementManager;
  }

  private createUIElements() {
    // 1. Top Bar
    this.topBarEl = document.createElement('div');
    this.topBarEl.className = 'hud-top-bar';
    this.domContainer.appendChild(this.topBarEl);

    // 2. Tower Palette (Bottom center)
    this.towerPaletteEl = document.createElement('div');
    this.towerPaletteEl.className = 'hud-tower-palette';
    this.domContainer.appendChild(this.towerPaletteEl);
    this.renderTowerPalette();
    this.trackHudInsets();

    // 3. Selected Tower Card (Bottom left)
    this.towerCardEl = document.createElement('div');
    this.towerCardEl.className = 'hud-card hud-tower-card';
    this.towerCardEl.style.display = 'none';
    this.domContainer.appendChild(this.towerCardEl);

    // 4. Selected Unit Inspector Card (Bottom right)
    this.unitCardEl = document.createElement('div');
    this.unitCardEl.className = 'hud-card hud-unit-card';
    this.unitCardEl.style.display = 'none';
    this.domContainer.appendChild(this.unitCardEl);

    // 5. Campaign World Map Modal
    this.campaignModalEl = document.createElement('div');
    this.campaignModalEl.className = 'modal-backdrop';
    this.campaignModalEl.style.display = 'none';
    this.domContainer.appendChild(this.campaignModalEl);

    // 6. Tech Tree Modal
    this.techModalEl = document.createElement('div');
    this.techModalEl.className = 'modal-backdrop';
    this.techModalEl.style.display = 'none';
    this.domContainer.appendChild(this.techModalEl);

    // 7. Victory Modal
    this.victoryModalEl = document.createElement('div');
    this.victoryModalEl.className = 'modal-backdrop';
    this.victoryModalEl.style.display = 'none';
    this.domContainer.appendChild(this.victoryModalEl);

    // 8. Defeat Modal
    this.defeatModalEl = document.createElement('div');
    this.defeatModalEl.className = 'modal-backdrop';
    this.defeatModalEl.style.display = 'none';
    this.domContainer.appendChild(this.defeatModalEl);

    // 9. Grand Boss Health Bar (Top Center)
    this.grandBossBarEl = document.createElement('div');
    this.grandBossBarEl.className = 'grand-boss-bar';
    this.grandBossBarEl.style.display = 'none';
    this.domContainer.appendChild(this.grandBossBarEl);

    // 10. Wave Intel & Scout Forecast Modal
    this.waveIntelModalEl = document.createElement('div');
    this.waveIntelModalEl.className = 'modal-backdrop';
    this.waveIntelModalEl.style.display = 'none';
    this.domContainer.appendChild(this.waveIntelModalEl);

    // 11. Tutorial / How to Play Modal
    this.tutorialModalEl = document.createElement('div');
    this.tutorialModalEl.className = 'modal-backdrop';
    this.tutorialModalEl.style.display = 'none';
    this.domContainer.appendChild(this.tutorialModalEl);

    // 12. Guardian Bastion Inspector Card (Bottom Left)
    this.guardianCardEl = document.createElement('div');
    this.guardianCardEl.className = 'hud-card hud-guardian-card';
    this.guardianCardEl.style.display = 'none';
    this.domContainer.appendChild(this.guardianCardEl);

    // 13. Focus Fire Indicator / Banner (Top Center below boss bar)
    this.focusBannerEl = document.createElement('div');
    this.focusBannerEl.className = 'hud-focus-banner';
    this.focusBannerEl.style.display = 'none';
    this.domContainer.appendChild(this.focusBannerEl);

    // 14. Royal Hall of Trophies Modal
    this.trophiesModalEl = document.createElement('div');
    this.trophiesModalEl.className = 'modal-backdrop';
    this.trophiesModalEl.style.display = 'none';
    this.domContainer.appendChild(this.trophiesModalEl);

    // 15. Achievement Unlocked Toast Notification
    this.achievementToastEl = document.createElement('div');
    this.achievementToastEl.className = 'achievement-toast';
    this.domContainer.appendChild(this.achievementToastEl);
  }

  private lastPlayerGold: number = 0;
  private lastTotalRecruits: number = 10;
  private lastRecruitCost: number = 25;
  private lastCanBuyRecruit: boolean = true;

  /**
   * Publishes how much screen the top bar and tower palette occupy (CSS vars --hud-top-offset /
   * --hud-bottom-offset) so overlays and cards never collide with them, whatever the layout wraps to.
   */
  private trackHudInsets() {
    const root = document.documentElement;
    const update = () => {
      const top = this.topBarEl.getBoundingClientRect();
      const bottom = this.towerPaletteEl.getBoundingClientRect();
      root.style.setProperty('--hud-top-offset', `${Math.round(top.bottom + 8)}px`);
      root.style.setProperty('--hud-bottom-offset', `${Math.round(window.innerHeight - bottom.top + 8)}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(this.topBarEl);
    observer.observe(this.towerPaletteEl);
    window.addEventListener('resize', update);
    update();
  }

  initMultiplayer(network: NetworkManager) {
    this.networkManager = network;
    this.multiplayerModal = new MultiplayerModal(this.domContainer, network);
  }

  renderTopBar(
    mission: CampaignMission,
    currentWave: number,
    totalWaves: number,
    gold: number,
    castleHp: number,
    castleMaxHp: number,
    gameSpeed: number,
    waveInProgress: boolean,
    phaseText: string = 'Prepare Maze',
    totalRecruits: number = 10,
    recruitCost: number = 25,
    canBuyRecruit: boolean = true,
    sunCastleHp?: number,
    moonCastleHp?: number,
    waveLabel?: string,
    readyVote?: { voted: boolean; count: number; total: number }
  ) {
    this.lastPlayerGold = gold;
    this.lastTotalRecruits = totalRecruits;
    this.lastRecruitCost = recruitCost;
    this.lastCanBuyRecruit = canBuyRecruit;
    this.currentMission = mission;
    this.currentWave = currentWave;

    const totalStars = this.techTree.getTotalStarsEarned();
    const isPvp = Boolean(this.networkManager?.inMatch && this.networkManager?.mode === 'PVP');

    this.topBarEl.innerHTML = `
      <div class="hud-group">
        ${isPvp ? '' : `<div class="hud-mission-title" title="${mission.title}">${mission.title}</div>`}
        <div class="hud-badge wave-badge">${waveLabel ?? `Wave ${currentWave} / ${totalWaves}`}</div>
        ${isPvp ? '' : `<button id="btn-wave-intel" class="hud-btn wave-intel-btn" title="Scout incoming enemy battalion intel (Hotkey: I)">👁️<span class="btn-label">Intel</span><span class="key-badge minor-key">I</span></button>`}
        <div class="hud-badge phase-badge font-bold">${phaseText}</div>
      </div>

      <div class="hud-group resources">
        ${isPvp ? `
          <div class="hud-stat" title="Team Sun Stronghold Health"><span class="icon">☀️</span> <span class="val text-amber-400 font-bold">${sunCastleHp ?? castleHp} HP</span></div>
          <div class="hud-stat" title="Team Moon Stronghold Health"><span class="icon">🌙</span> <span class="val text-rose-400 font-bold">${moonCastleHp ?? castleHp} HP</span></div>
          <div class="hud-stat" title="Your Personal Gold Reserve"><span class="icon">🪙</span> <span class="val text-amber-400 font-bold">${gold}g</span></div>
        ` : `
          <div class="hud-stat" title="Gold Reserve"><span class="icon">🪙</span> <span class="val text-amber-400 font-bold">${gold}g</span></div>
          <div class="hud-stat" title="Arena Stronghold Castle Health"><span class="icon">🏰</span> <span class="val ${castleHp > castleMaxHp * 0.5 ? 'text-emerald-400' : castleHp > castleMaxHp * 0.25 ? 'text-amber-400' : 'text-rose-400'} font-bold">${Math.max(0, castleHp)} / ${castleMaxHp}</span></div>
          <div class="hud-stat" title="Campaign Stars"><span class="icon">⭐</span> <span class="val text-yellow-300 font-bold">${totalStars}</span></div>
        `}
      </div>

      <div class="hud-group controls">
        <button id="btn-focus-fire" class="hud-btn btn-focus-fire" title="Focus Fire: Direct all towers in range and champions to focus on an enemy (Hotkey: F)">
          🎯<span class="btn-label">Focus</span><span class="key-badge minor-key">F</span>
        </button>
        <button id="btn-smart-focus" class="hud-btn btn-smart-focus ${this.towerManager?.smartFocusEnabled ? 'active' : ''}" title="Smart Focus: single-target buff towers follow their target priority (set on each tower's card). Off: they buff the lead unit (Hotkey: Z)">
          ✨<span class="btn-label">Smart</span><span class="${this.towerManager?.smartFocusEnabled ? 'text-amber-400 font-bold' : 'text-slate-400'}">${this.towerManager?.smartFocusEnabled ? 'ON' : 'OFF'}</span><span class="key-badge minor-key">Z</span>
        </button>
        <button id="btn-speed" class="hud-btn speed-btn">${gameSpeed === 0 ? '⏸️ PAUSED' : gameSpeed + 'x'}</button>
        ${isPvp
          ? (readyVote ? `<button id="btn-send-wave" class="hud-btn wave-btn ${readyVote.voted ? 'active' : ''}" title="Vote to start the first round early once every commander is ready (Hotkey: Space)">
          ${readyVote.voted ? '✅' : '✋'} Ready ${readyVote.count}/${readyVote.total}<span class="key-badge">Space</span>
        </button>` : '')
          : `<button id="btn-send-wave" class="hud-btn wave-btn ${waveInProgress ? 'disabled' : ''}" title="Release Wave (Hotkey: Space or Enter)">
          ${waveInProgress ? '⚔️ Wave Active' : '⚔️ Release Wave<span class="key-badge">Space</span>'}
        </button>`}
        <span class="hud-divider"></span>
        <button id="btn-multiplayer" class="hud-btn icon-btn mp-btn" title="Multiplayer War Room: Co-Op & 4v4 PvP">🤝</button>
        <button id="btn-trophies" class="hud-btn icon-btn" title="Royal Hall of Trophies / Achievements (Hotkey: Y)">
          🏆${this.achievementManager ? `<span class="trophies-badge-count text-amber-400 font-bold">${this.achievementManager.getTotalTrophiesEarned().unlocked}/${this.achievementManager.getTotalTrophiesEarned().total}</span>` : ''}
        </button>
        <button id="btn-tech" class="hud-btn icon-btn" title="Armory / Tech Tree">🛠️</button>
        <button id="btn-campaign" class="hud-btn icon-btn" title="Campaign Map">🗺️</button>
        <button id="btn-guide" class="hud-btn icon-btn" title="How to Play / Game Mechanics Guide (Hotkey: H or ?)">❓</button>
        <button id="btn-audio" class="hud-btn icon-btn" title="Audio Toggle">${audio.enabled ? '🔊' : '🔇'}</button>
      </div>
    `;

    this.topBarEl.querySelector('#btn-multiplayer')?.addEventListener('click', () => {
      if (this.multiplayerModal) {
        this.multiplayerModal.open('host');
      }
    });

    // Wave intel button handler
    this.topBarEl.querySelector('#btn-wave-intel')?.addEventListener('click', () => {
      this.toggleWaveIntel(mission, currentWave - 1);
    });

    // Focus Fire button handler
    this.topBarEl.querySelector('#btn-focus-fire')?.addEventListener('click', () => {
      this.onToggleFocusFire();
    });

    // Smart Focus button handler
    this.topBarEl.querySelector('#btn-smart-focus')?.addEventListener('click', () => {
      this.onToggleSmartFocus();
    });

    // Speed button handler
    const btnSpeed = this.topBarEl.querySelector('#btn-speed');
    btnSpeed?.addEventListener('click', () => {
      const speeds = [1, 2, 4, 0];
      const currentIdx = speeds.indexOf(gameSpeed);
      const nextSpeed = speeds[(currentIdx + 1) % speeds.length];
      this.onSetGameSpeed(nextSpeed);
    });

    // Send Wave button handler
    const btnSendWave = this.topBarEl.querySelector('#btn-send-wave');
    btnSendWave?.addEventListener('click', () => {
      if (!waveInProgress) {
        this.onStartWave();
      }
    });

    // Trophies / Achievements button
    this.topBarEl.querySelector('#btn-trophies')?.addEventListener('click', () => this.showAchievementsModal());

    // Tech tree button
    this.topBarEl.querySelector('#btn-tech')?.addEventListener('click', () => this.showTechTree());

    // Campaign button
    this.topBarEl.querySelector('#btn-campaign')?.addEventListener('click', () => this.showCampaignMap());

    // Guide / Tutorial button
    this.topBarEl.querySelector('#btn-guide')?.addEventListener('click', () => this.showTutorialModal(true));

    // Audio button
    this.topBarEl.querySelector('#btn-audio')?.addEventListener('click', () => {
      audio.enabled = !audio.enabled;
      this.renderTopBar(
        mission, currentWave, totalWaves, gold, castleHp, castleMaxHp,
        gameSpeed, waveInProgress, phaseText, totalRecruits, recruitCost, canBuyRecruit
      );
    });
  }

  public updateFocusFireState(isAiming: boolean, target: Unit | null) {
    const btn = this.topBarEl.querySelector('#btn-focus-fire');
    if (btn) {
      if (isAiming || target) {
        btn.classList.add('active');
        if (target) {
          btn.innerHTML = `🎯<span class="btn-label">Locked</span><span class="key-badge minor-key">F</span>`;
        } else {
          btn.innerHTML = `🎯<span class="btn-label">Aiming</span><span class="key-badge minor-key">F</span>`;
        }
      } else {
        btn.classList.remove('active');
        btn.innerHTML = `🎯<span class="btn-label">Focus</span><span class="key-badge minor-key">F</span>`;
      }
    }

    if (target && !target.isDead && !target.isDying) {
      this.focusBannerEl.style.display = 'flex';
      this.focusBannerEl.innerHTML = `
        <div class="focus-banner-content locked">
          <span class="focus-pulse-dot"></span>
          <span class="focus-label">🎯 TOWER FOCUS:</span>
          <span class="focus-target-name">${target.stats.name}</span>
          <span class="focus-target-hp">${Math.max(0, Math.round(target.currentHp))} / ${target.maxHp} HP</span>
          <button id="btn-clear-focus-badge" class="focus-clear-btn" title="Cancel Focus Target (Esc)">✕</button>
        </div>
      `;
      this.focusBannerEl.querySelector('#btn-clear-focus-badge')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onClearFocusTarget();
      });
    } else if (isAiming) {
      this.focusBannerEl.style.display = 'flex';
      this.focusBannerEl.innerHTML = `
        <div class="focus-banner-content aiming">
          <span class="focus-pulse-dot aiming-dot"></span>
          <span class="focus-label">🎯 TARGETING MODE:</span>
          <span class="focus-hint">Click any enemy raider to focus fire! (Press A or Esc to cancel)</span>
          <button id="btn-cancel-aim-badge" class="focus-clear-btn" title="Cancel Targeting (Esc)">✕</button>
        </div>
      `;
      this.focusBannerEl.querySelector('#btn-cancel-aim-badge')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onToggleFocusFire();
      });
    } else {
      this.focusBannerEl.style.display = 'none';
    }
  }

  isTowerCardOpen(): boolean {
    return this.towerCardEl.style.display !== 'none';
  }

  renderTowerPalette(
    playerGold?: number,
    totalRecruits?: number,
    recruitCost?: number,
    canBuyRecruit?: boolean
  ) {
    if (playerGold !== undefined) this.lastPlayerGold = playerGold;
    if (totalRecruits !== undefined) this.lastTotalRecruits = totalRecruits;
    if (recruitCost !== undefined) this.lastRecruitCost = recruitCost;
    if (canBuyRecruit !== undefined) this.lastCanBuyRecruit = canBuyRecruit;

    const currentGold = this.lastPlayerGold;
    const recruits = this.lastTotalRecruits;
    const cost = this.lastRecruitCost;
    const canBuy = this.lastCanBuyRecruit;

    this.towerPaletteEl.innerHTML = '';

    // 1. Recruit Unit Card at start of palette
    const canAffordRecruit = currentGold >= cost && canBuy;
    const recruitBtn = document.createElement('div');
    recruitBtn.className = `tower-btn recruit-card-btn ${!canAffordRecruit ? 'unaffordable' : ''}`;
    recruitBtn.innerHTML = `
      <div class="tower-btn-hotkey">R</div>
      <div class="tower-btn-title">🛡️ Recruit</div>
      <div class="tower-btn-cost ${!canAffordRecruit ? 'cost-locked' : ''}">🪙 ${cost}g</div>
      <div class="tower-tooltip">
        <strong>Hire Extra Recruit [Hotkey: R]</strong> (${cost}g)
        <div class="desc">Trains +1 friendly recruit for this wave's army.<br><strong>Current Army:</strong> ${recruits} Recruits (10 Base + ${Math.max(0, recruits - 10)} Extra)</div>
      </div>
    `;
    recruitBtn.addEventListener('click', () => {
      this.onBuyRecruit();
    });
    this.towerPaletteEl.appendChild(recruitBtn);

    // 2. Tower placement cards (Hotkeys 1 - 8)
    const types = [
      TowerType.SHRINE,      // 1
      TowerType.FORGE,       // 2
      TowerType.OBELISK,     // 3
      TowerType.AURA,        // 4
      TowerType.FROST,       // 5
      TowerType.RULEBREAKER, // 6
      TowerType.GOLD,        // 7
      TowerType.EVOLUTION    // 8
    ];

    types.forEach((type, idx) => {
      const def = TOWER_DEFINITIONS[type];
      const isGold = type === TowerType.GOLD;
      const goldCount = isGold && this.towerManager ? this.towerManager.getTowerCountByType(TowerType.GOLD) : 0;
      const isGoldLimitReached = isGold && goldCount >= 4;

      const canAfford = currentGold >= def.cost && !isGoldLimitReached;
      const btn = document.createElement('div');
      btn.className = `tower-btn ${this.selectedTowerTypeForPlacement === type ? 'active' : ''} ${!canAfford ? 'unaffordable' : ''}`;
      const displayName = def.name.replace(/^The\s+/, '').split(' ')[0];
      const hotkey = idx + 1;
      const costDisplay = isGoldLimitReached
        ? `<div class="tower-btn-cost cost-locked">🪙 ${def.cost}g <span class="text-[9px] text-amber-400 block font-bold">Max 4/4</span></div>`
        : `<div class="tower-btn-cost ${!canAfford ? 'cost-locked' : ''}">🪙 ${def.cost}g ${isGold ? `(${goldCount}/4)` : ''}</div>`;

      const limitNotice = isGoldLimitReached
        ? '<div class="text-amber-300 font-bold mt-1">⚠️ Tower limit reached (4/4 built)!</div>'
        : (isGold ? `<div class="text-amber-300 font-medium mt-1">Active Spires: ${goldCount}/4</div>` : '');

      btn.innerHTML = `
        <div class="tower-btn-hotkey">${hotkey}</div>
        <div class="tower-btn-title">${displayName}</div>
        ${costDisplay}
        <div class="tower-tooltip">
          <strong>${def.name} [Hotkey: ${hotkey}]</strong> (${def.cost}g)
          ${limitNotice}
          <div class="desc">${def.description}</div>
          <div class="branches">
            <div>⚡ <em>${def.branchA[0].badge}</em>: ${def.branchA[0].name.replace(/ I$/, '')} (${def.branchA.length} Ranks)</div>
            <div>🌱 <em>${def.branchB[0].badge}</em>: ${def.branchB[0].name.replace(/ I$/, '')} (${def.branchB.length} Ranks)</div>
          </div>
        </div>
      `;

      btn.addEventListener('click', () => {
        if (isGoldLimitReached && this.selectedTowerTypeForPlacement !== type) {
          audio.playDefeat();
          return;
        }
        if (!canAfford && this.selectedTowerTypeForPlacement !== type) {
          audio.playDefeat();
          return;
        }
        if (this.selectedTowerTypeForPlacement === type) {
          this.selectedTowerTypeForPlacement = null;
        } else {
          this.selectedTowerTypeForPlacement = type;
        }
        this.renderTowerPalette();
        this.onSelectTowerPlacement(this.selectedTowerTypeForPlacement);
      });

      this.towerPaletteEl.appendChild(btn);
    });
  }

  selectTowerTypeForPlacement(type: TowerType | null) {
    if (this.selectedTowerTypeForPlacement === type) {
      this.selectedTowerTypeForPlacement = null;
    } else {
      this.selectedTowerTypeForPlacement = type;
    }
    this.renderTowerPalette();
    this.onSelectTowerPlacement(this.selectedTowerTypeForPlacement);
  }

  triggerTowerUpgradeHotkey(index: 1 | 2 | 3 | 4): boolean {
    if (!this.isTowerCardOpen() || !this.currentTowerCardIsOwner) return false;

    let targetBtn: HTMLButtonElement | null = null;
    if (index === 1) {
      targetBtn = this.towerCardEl.querySelector<HTMLButtonElement>('#btn-upg-a')
        || this.towerCardEl.querySelector<HTMLButtonElement>('#btn-evo-ab1')
        || this.towerCardEl.querySelector<HTMLButtonElement>('#btn-upg-next');
    } else if (index === 2) {
      targetBtn = this.towerCardEl.querySelector<HTMLButtonElement>('#btn-upg-b')
        || this.towerCardEl.querySelector<HTMLButtonElement>('#btn-evo-ab2');
    } else if (index === 3) {
      targetBtn = this.towerCardEl.querySelector<HTMLButtonElement>('#btn-upg-c')
        || this.towerCardEl.querySelector<HTMLButtonElement>('#btn-evo-ab3');
    } else if (index === 4) {
      targetBtn = this.towerCardEl.querySelector<HTMLButtonElement>('#btn-evo-ab4');
    }

    if (targetBtn) {
      targetBtn.click();
      return true;
    }
    return false;
  }

  showTowerCard(
    tower: TowerInstance,
    playerGold: number,
    onUpgrade: (branch: UpgradeBranch) => void,
    onSell: () => void,
    onUpgradeAbility?: (abilityIndex: 1 | 2 | 3 | 4) => void,
    isOwner: boolean = true
  ) {
    this.currentTowerCardIsOwner = isOwner;
    const def = TOWER_DEFINITIONS[tower.type];
    const isEvo = tower.type === TowerType.EVOLUTION;
    const isUnbranched = tower.currentBranch === UpgradeBranch.NONE;
    const isMultiplayer = Boolean(this.networkManager?.inMatch);
    const ownerName = escapeHtml(tower.ownerName || 'the builder');

    let ownerBannerHTML = '';
    if (isMultiplayer) {
      if (isOwner) {
        ownerBannerHTML = `
          <div class="tower-owner-badge self">
            <span>👑 Your Tower (You)</span>
            <span class="tower-owner-pill">Owner</span>
          </div>
        `;
      } else {
        ownerBannerHTML = `
          <div class="tower-owner-badge ally">
            <span>🛡️ Built by ally: <strong>${escapeHtml(tower.ownerName || 'Teammate')}</strong></span>
            <span class="tower-owner-pill">Protected</span>
          </div>
        `;
      }
    }

    let branchHTML = '';
    if (isEvo && tower.evoPath) {
      // Specialized Evolution Spire Panel
      const isSoldier = tower.evoPath === 'SOLDIER';
      const isArcher = tower.evoPath === 'ARCHER';
      const pathTitle = isSoldier ? '⚔️ Soldier Forge' : (isArcher ? '🏹 Archer Forge' : '🔮 Mage Sanctum');
      const pathBadge = isSoldier
        ? 'Melee Champion (3,750 HP Cap)'
        : (isArcher ? 'Ranged Marksman (3,000 HP Cap)' : 'Arcane Pyromancer (2,550 HP Cap)');
      const quotaHTML = tower.hasEvolvedThisWave
        ? `<div id="tower-live-quota" class="p-2 mb-2 rounded bg-amber-950/70 border border-amber-600/60 text-amber-300 text-xs font-semibold text-center">🔒 1/1 Unit Evolved this wave (Next wave recharges)</div>`
        : `<div id="tower-live-quota" class="p-2 mb-2 rounded bg-emerald-950/70 border border-emerald-600/60 text-emerald-300 text-xs font-semibold text-center">⚡ Ready to evolve 1 unit (Requires 250 HP)</div>`;

      // Ability 1 details
      const ab1Name = isSoldier ? 'Armor Aura' : (isArcher ? 'Multishot' : 'Arcane Siphon');
      const ab1List = isSoldier ? SOLDIER_ABILITIES.armorAura : (isArcher ? ARCHER_ABILITIES.multishot : MAGE_ABILITIES.manaGain);
      const ab1Level = tower.ability1Level;
      const curAb1Desc = ab1Level === 0 ? 'Not Unlocked' : ab1List[ab1Level - 1].description;
      const nextAb1 = ab1Level < ab1List.length ? ab1List[ab1Level] : null;

      // Ability 2 details
      const ab2Name = isSoldier ? 'Relentless Assault' : (isArcher ? 'Damage Aura' : 'Mega Fireball');
      const ab2List = isSoldier ? SOLDIER_ABILITIES.relentless : (isArcher ? ARCHER_ABILITIES.damageAura : MAGE_ABILITIES.fireball);
      const ab2Level = tower.ability2Level;
      const curAb2Desc = ab2Level === 0 ? 'Not Unlocked' : ab2List[ab2Level - 1].description;
      const nextAb2 = ab2Level < ab2List.length ? ab2List[ab2Level] : null;

      // Ability 3 details
      const ab3Name = isSoldier ? 'Iron Vigor' : (isArcher ? 'Sundering Shot' : 'Paralyzing Arc');
      const ab3List = isSoldier ? SOLDIER_ABILITIES.lifeRegen : (isArcher ? ARCHER_ABILITIES.armorShred : MAGE_ABILITIES.stun);
      const ab3Level = tower.ability3Level;
      const curAb3Desc = ab3Level === 0 ? 'Not Unlocked' : ab3List[ab3Level - 1].description;
      const nextAb3 = ab3Level < ab3List.length ? ab3List[ab3Level] : null;

      // Ability 4 details
      const ab4Name = isSoldier ? 'Spiked Bulwark' : (isArcher ? 'Rapid Quiver' : 'Molten Pyre');
      const ab4List = isSoldier ? SOLDIER_ABILITIES.thorns : (isArcher ? ARCHER_ABILITIES.rapidQuiver : MAGE_ABILITIES.burn);
      const ab4Level = tower.ability4Level;
      const curAb4Desc = ab4Level === 0 ? 'Not Unlocked' : ab4List[ab4Level - 1].description;
      const nextAb4 = ab4Level < ab4List.length ? ab4List[ab4Level] : null;

      let abilitiesContent = '';
      if (isOwner) {
        abilitiesContent = `
          <div class="upgrade-header mt-2">Champion Abilities (Building Specific):</div>
          <div class="upgrade-options">
            <!-- Ability 1 -->
            <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/70">
              <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-bold text-sky-300">${ab1Name} (Lv. ${ab1Level}/${ab1List.length})</span>
                ${ab1Level >= ab1List.length ? '<span class="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700/50">MAX</span>' : ''}
              </div>
              <div class="text-[11px] text-slate-300 mb-2">${curAb1Desc}</div>
              ${nextAb1 ? `
                <button id="btn-evo-ab1" class="upgrade-btn w-full ${playerGold < nextAb1.cost ? 'disabled' : ''}">
                  <div class="flex justify-between items-center">
                    <span class="upg-name text-xs font-bold"><span class="key-badge">1</span>${nextAb1.name}</span>
                    <span class="upg-cost text-xs font-bold">🪙 ${nextAb1.cost}g</span>
                  </div>
                  <div class="upg-desc text-[11px] mt-0.5">${nextAb1.description}</div>
                </button>
              ` : ''}
            </div>

            <!-- Ability 2 -->
            <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/70">
              <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-bold text-sky-300">${ab2Name} (Lv. ${ab2Level}/${ab2List.length})</span>
                ${ab2Level >= ab2List.length ? '<span class="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700/50">MAX</span>' : ''}
              </div>
              <div class="text-[11px] text-slate-300 mb-2">${curAb2Desc}</div>
              ${nextAb2 ? `
                <button id="btn-evo-ab2" class="upgrade-btn w-full ${playerGold < nextAb2.cost ? 'disabled' : ''}">
                  <div class="flex justify-between items-center">
                    <span class="upg-name text-xs font-bold"><span class="key-badge">2</span>${nextAb2.name}</span>
                    <span class="upg-cost text-xs font-bold">🪙 ${nextAb2.cost}g</span>
                  </div>
                  <div class="upg-desc text-[11px] mt-0.5">${nextAb2.description}</div>
                </button>
              ` : ''}
            </div>

            <!-- Ability 3 -->
            <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/70">
              <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-bold text-sky-300">${ab3Name} (Lv. ${ab3Level}/${ab3List.length})</span>
                ${ab3Level >= ab3List.length ? '<span class="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700/50">MAX</span>' : ''}
              </div>
              <div class="text-[11px] text-slate-300 mb-2">${curAb3Desc}</div>
              ${nextAb3 ? `
                <button id="btn-evo-ab3" class="upgrade-btn w-full ${playerGold < nextAb3.cost ? 'disabled' : ''}">
                  <div class="flex justify-between items-center">
                    <span class="upg-name text-xs font-bold"><span class="key-badge">3</span>${nextAb3.name}</span>
                    <span class="upg-cost text-xs font-bold">🪙 ${nextAb3.cost}g</span>
                  </div>
                  <div class="upg-desc text-[11px] mt-0.5">${nextAb3.description}</div>
                </button>
              ` : ''}
            </div>

            <!-- Ability 4 -->
            <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/70">
              <div class="flex justify-between items-center mb-1">
                <span class="text-xs font-bold text-sky-300">${ab4Name} (Lv. ${ab4Level}/${ab4List.length})</span>
                ${ab4Level >= ab4List.length ? '<span class="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700/50">MAX</span>' : ''}
              </div>
              <div class="text-[11px] text-slate-300 mb-2">${curAb4Desc}</div>
              ${nextAb4 ? `
                <button id="btn-evo-ab4" class="upgrade-btn w-full ${playerGold < nextAb4.cost ? 'disabled' : ''}">
                  <div class="flex justify-between items-center">
                    <span class="upg-name text-xs font-bold"><span class="key-badge">4</span>${nextAb4.name}</span>
                    <span class="upg-cost text-xs font-bold">🪙 ${nextAb4.cost}g</span>
                  </div>
                  <div class="upg-desc text-[11px] mt-0.5">${nextAb4.description}</div>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      } else {
        abilitiesContent = `
          <div class="upgrade-header mt-2">Champion Abilities:</div>
          <div class="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-center text-xs text-slate-400 my-2">
            🔒 Abilities are upgraded exclusively by <strong class="text-sky-300">${ownerName}</strong>.
          </div>
        `;
      }

      branchHTML = `
        <div class="upgraded-badge mb-1">✨ Active Forge: ${pathTitle}</div>
        <div class="text-[11px] text-slate-300 mb-2">${pathBadge}</div>
        ${quotaHTML}
        ${abilitiesContent}
      `;
    } else if (isUnbranched) {
      if (!isOwner) {
        branchHTML = `
          <div class="upgrade-header">Branching Path:</div>
          <div class="p-3 rounded-lg bg-slate-900/90 border border-slate-700/80 text-center text-xs text-slate-400 my-2">
            🔒 Specialization path is chosen exclusively by <strong class="text-sky-300">${ownerName}</strong>.
          </div>
        `;
      } else {
        const bA = def.branchA[0];
        const bB = def.branchB[0];
        const bC = def.branchC ? def.branchC[0] : null;
        branchHTML = `
          <div class="upgrade-header">Choose Branching Path:</div>
          <div class="upgrade-options">
            <button id="btn-upg-a" class="upgrade-btn ${playerGold < bA.cost ? 'disabled' : ''}">
              <div class="upg-badge"><span class="key-badge">1</span>${bA.badge} (Rank 1/${def.branchA.length})</div>
              <div class="upg-name">${bA.name}</div>
              <div class="upg-cost">🪙 ${bA.cost}g</div>
              <div class="upg-desc">${bA.description}</div>
            </button>
            <button id="btn-upg-b" class="upgrade-btn ${playerGold < bB.cost ? 'disabled' : ''}">
              <div class="upg-badge"><span class="key-badge">2</span>${bB.badge} (Rank 1/${def.branchB.length})</div>
              <div class="upg-name">${bB.name}</div>
              <div class="upg-cost">🪙 ${bB.cost}g</div>
              <div class="upg-desc">${bB.description}</div>
            </button>
            ${bC ? `
              <button id="btn-upg-c" class="upgrade-btn ${playerGold < bC.cost ? 'disabled' : ''}">
                <div class="upg-badge"><span class="key-badge">3</span>${bC.badge} (Rank 1/${def.branchC?.length || 1})</div>
                <div class="upg-name">${bC.name}</div>
                <div class="upg-cost">🪙 ${bC.cost}g</div>
                <div class="upg-desc">${bC.description}</div>
              </button>
            ` : ''}
          </div>
        `;
      }
    } else {
      const curUpg = this.towerManager.getCurrentUpgrade(tower);
      const next = this.towerManager.getNextUpgrade(tower);
      const branchList = tower.currentBranch === UpgradeBranch.BRANCH_A ? def.branchA : def.branchB;
      const totalRanks = branchList.length;

      let nextUpgradeHTML = '';
      if (!isOwner) {
        nextUpgradeHTML = `
          <div class="p-2.5 mt-2 rounded-lg bg-slate-900/90 border border-slate-700/80 text-center text-xs text-slate-400">
            🔒 Rank upgrades are managed exclusively by <strong class="text-sky-300">${ownerName}</strong>.
          </div>
        `;
      } else if (next) {
        nextUpgradeHTML = `
          <div class="upgrade-header mt-2">Next Rank Upgrade (${tower.branchLevel + 1}/${totalRanks}):</div>
          <div class="upgrade-options">
            <button id="btn-upg-next" class="upgrade-btn ${playerGold < next.upg.cost ? 'disabled' : ''}">
              <div class="upg-badge"><span class="key-badge">1</span>${next.upg.badge} (Rank ${tower.branchLevel + 1}/${totalRanks})</div>
              <div class="upg-name">${next.upg.name}</div>
              <div class="upg-cost">🪙 ${next.upg.cost}g</div>
              <div class="upg-desc">${next.upg.description}</div>
            </button>
          </div>
        `;
      } else {
        nextUpgradeHTML = `
          <div class="text-xs text-amber-300 font-bold bg-amber-950/40 p-2 rounded border border-amber-800/40 text-center mt-2">
            🌟 Maximum Rank Achieved (${totalRanks}/${totalRanks})!
          </div>
        `;
      }

      branchHTML = `
        <div class="upgraded-badge">✨ Active Path: ${curUpg?.name || 'Upgraded'} (${curUpg?.badge} - Rank ${tower.branchLevel}/${totalRanks})</div>
        <div class="upgraded-desc">${curUpg?.description || ''}</div>
        ${nextUpgradeHTML}
      `;
    }

    const refund = Math.floor(tower.totalCostInvested * 0.75);
    const summary = this.towerManager.getTowerStatsSummary(tower);

    this.towerCardEl.style.display = 'block';
    this.towerCardEl.innerHTML = `
      <div class="card-header">
        <div class="card-title">${def.name} (Tier ${tower.level})</div>
        <button id="btn-close-tower" class="close-btn">&times;</button>
      </div>
      ${ownerBannerHTML}
      <div class="tower-buff-display mb-3">
        <div id="tower-live-effect" class="text-sm font-bold text-sky-400 bg-sky-950/60 p-2 rounded border border-sky-800/60 mb-1">
          ✨ ${summary.currentEffect}
        </div>
        <div id="tower-live-lifetime" class="text-xs text-slate-400 font-medium">
          📊 ${summary.lifetimeOutput}
        </div>
      </div>
      <div id="tower-live-stats" class="card-stats">
        <div>Range: <strong>${tower.effectiveRange.toFixed(1)}</strong></div>
        <div>Cast Interval: <strong>${tower.effectiveRate.toFixed(2)}s</strong></div>
        ${tower.auraBonusMultiplier > 0 ? `<div class="text-purple-400">Aura Haste: <strong>+${Math.round(tower.auraBonusMultiplier * 100)}%</strong></div>` : ''}
      </div>
      ${this.renderTargetPriorityPicker(tower, isOwner)}
      ${branchHTML}
      <div class="card-actions">
        ${isOwner ? `
          <button id="btn-sell" class="sell-btn">Sell (Refund 🪙 ${refund}g)</button>
        ` : `
          <button id="btn-sell" class="sell-btn disabled" disabled style="opacity: 0.45; cursor: not-allowed; background: #1e293b; border: 1px solid #334155; color: #94a3b8;" title="Only ${ownerName} can sell this tower">
            🔒 Owned by ${escapeHtml(tower.ownerName || 'Teammate')} (Cannot Sell)
          </button>
        `}
      </div>
    `;

    this.towerCardEl.querySelector('#btn-close-tower')?.addEventListener('click', () => {
      this.hideTowerCard();
      this.towerManager.selectTower(null);
    });

    this.towerCardEl.querySelector('#btn-card-smart-focus')?.addEventListener('click', () => {
      this.onToggleSmartFocus();
    });
    if (isOwner) {
      this.towerCardEl.querySelectorAll<HTMLButtonElement>('.target-chip').forEach(chip => {
        chip.addEventListener('click', () => this.onSetTargetPriority(tower.id, chip.dataset.priority as TargetPriority));
      });
    }

    if (isOwner) {
      if (isEvo && tower.evoPath) {
        this.towerCardEl.querySelector('#btn-evo-ab1')?.addEventListener('click', () => onUpgradeAbility?.(1));
        this.towerCardEl.querySelector('#btn-evo-ab2')?.addEventListener('click', () => onUpgradeAbility?.(2));
        this.towerCardEl.querySelector('#btn-evo-ab3')?.addEventListener('click', () => onUpgradeAbility?.(3));
        this.towerCardEl.querySelector('#btn-evo-ab4')?.addEventListener('click', () => onUpgradeAbility?.(4));
      } else if (isUnbranched) {
        this.towerCardEl.querySelector('#btn-upg-a')?.addEventListener('click', () => onUpgrade(UpgradeBranch.BRANCH_A));
        this.towerCardEl.querySelector('#btn-upg-b')?.addEventListener('click', () => onUpgrade(UpgradeBranch.BRANCH_B));
        this.towerCardEl.querySelector('#btn-upg-c')?.addEventListener('click', () => onUpgrade(UpgradeBranch.BRANCH_C));
      } else {
        this.towerCardEl.querySelector('#btn-upg-next')?.addEventListener('click', () => onUpgrade(tower.currentBranch));
      }
      this.towerCardEl.querySelector('#btn-sell')?.addEventListener('click', onSell);
    }
  }

  /**
   * Lightweight per-frame live update for the tower inspection card
   * Updates total healed, damage boosted, armor plated, gold minted, and ability affordability in real time without tearing down DOM.
   */
  updateTowerCardLiveStats(tower: TowerInstance, playerGold: number) {
    if (!this.isTowerCardOpen() || !this.towerManager) return;
    const summary = this.towerManager.getTowerStatsSummary(tower);

    const effectEl = this.towerCardEl.querySelector<HTMLElement>('#tower-live-effect');
    if (effectEl) {
      const effectText = `✨ ${summary.currentEffect}`;
      if (effectEl.textContent !== effectText) {
        effectEl.textContent = effectText;
      }
    }

    const lifetimeEl = this.towerCardEl.querySelector<HTMLElement>('#tower-live-lifetime');
    if (lifetimeEl) {
      const lifetimeText = `📊 ${summary.lifetimeOutput}`;
      if (lifetimeEl.textContent !== lifetimeText) {
        lifetimeEl.textContent = lifetimeText;
      }
    }

    const statsEl = this.towerCardEl.querySelector<HTMLElement>('#tower-live-stats');
    if (statsEl) {
      const statsHTML = `
        <div>Range: <strong>${tower.effectiveRange.toFixed(1)}</strong></div>
        <div>Cast Interval: <strong>${tower.effectiveRate.toFixed(2)}s</strong></div>
        ${tower.auraBonusMultiplier > 0 ? `<div class="text-purple-400">Aura Haste: <strong>+${Math.round(tower.auraBonusMultiplier * 100)}%</strong></div>` : ''}
      `;
      if (statsEl.innerHTML.trim() !== statsHTML.trim()) {
        statsEl.innerHTML = statsHTML;
      }
    }

    // Evolution Spire Quota Status
    const quotaEl = this.towerCardEl.querySelector<HTMLElement>('#tower-live-quota');
    if (quotaEl) {
      const quotaHTML = tower.hasEvolvedThisWave
        ? '🔒 1/1 Unit Evolved this wave (Next wave recharges)'
        : '⚡ Ready to evolve 1 unit (Requires 250 HP)';
      if (quotaEl.textContent !== quotaHTML) {
        quotaEl.textContent = quotaHTML;
        quotaEl.className = tower.hasEvolvedThisWave
          ? 'p-2 mb-2 rounded bg-amber-950/70 border border-amber-600/60 text-amber-300 text-xs font-semibold text-center'
          : 'p-2 mb-2 rounded bg-emerald-950/70 border border-emerald-600/60 text-emerald-300 text-xs font-semibold text-center';
      }
    }

    if (!this.currentTowerCardIsOwner) return;

    // Dynamic Upgrade Button Affordability
    const def = TOWER_DEFINITIONS[tower.type];
    const isEvo = tower.type === TowerType.EVOLUTION;
    const isUnbranched = tower.currentBranch === UpgradeBranch.NONE;

    if (isEvo && tower.evoPath) {
      const isSoldier = tower.evoPath === 'SOLDIER';
      const isArcher = tower.evoPath === 'ARCHER';
      const ab1List = isSoldier ? SOLDIER_ABILITIES.armorAura : (isArcher ? ARCHER_ABILITIES.multishot : MAGE_ABILITIES.manaGain);
      const ab2List = isSoldier ? SOLDIER_ABILITIES.relentless : (isArcher ? ARCHER_ABILITIES.damageAura : MAGE_ABILITIES.fireball);
      const ab3List = isSoldier ? SOLDIER_ABILITIES.lifeRegen : (isArcher ? ARCHER_ABILITIES.armorShred : MAGE_ABILITIES.stun);
      const ab4List = isSoldier ? SOLDIER_ABILITIES.thorns : (isArcher ? ARCHER_ABILITIES.rapidQuiver : MAGE_ABILITIES.burn);
      const nextAb1 = tower.ability1Level < ab1List.length ? ab1List[tower.ability1Level] : null;
      const nextAb2 = tower.ability2Level < ab2List.length ? ab2List[tower.ability2Level] : null;
      const nextAb3 = tower.ability3Level < ab3List.length ? ab3List[tower.ability3Level] : null;
      const nextAb4 = tower.ability4Level < ab4List.length ? ab4List[tower.ability4Level] : null;

      const btnAb1 = this.towerCardEl.querySelector<HTMLButtonElement>('#btn-evo-ab1');
      if (btnAb1 && nextAb1) {
        btnAb1.classList.toggle('disabled', playerGold < nextAb1.cost);
      }
      const btnAb2 = this.towerCardEl.querySelector<HTMLButtonElement>('#btn-evo-ab2');
      if (btnAb2 && nextAb2) {
        btnAb2.classList.toggle('disabled', playerGold < nextAb2.cost);
      }
      const btnAb3 = this.towerCardEl.querySelector<HTMLButtonElement>('#btn-evo-ab3');
      if (btnAb3 && nextAb3) {
        btnAb3.classList.toggle('disabled', playerGold < nextAb3.cost);
      }
      const btnAb4 = this.towerCardEl.querySelector<HTMLButtonElement>('#btn-evo-ab4');
      if (btnAb4 && nextAb4) {
        btnAb4.classList.toggle('disabled', playerGold < nextAb4.cost);
      }
    } else if (isUnbranched) {
      const btnA = this.towerCardEl.querySelector<HTMLButtonElement>('#btn-upg-a');
      const btnB = this.towerCardEl.querySelector<HTMLButtonElement>('#btn-upg-b');
      const btnC = this.towerCardEl.querySelector<HTMLButtonElement>('#btn-upg-c');
      if (btnA && def.branchA?.[0]) btnA.classList.toggle('disabled', playerGold < def.branchA[0].cost);
      if (btnB && def.branchB?.[0]) btnB.classList.toggle('disabled', playerGold < def.branchB[0].cost);
      if (btnC && def.branchC?.[0]) btnC.classList.toggle('disabled', playerGold < def.branchC[0].cost);
    } else {
      const next = this.towerManager.getNextUpgrade(tower);
      const btnNext = this.towerCardEl.querySelector<HTMLButtonElement>('#btn-upg-next');
      if (btnNext && next) {
        btnNext.classList.toggle('disabled', playerGold < next.upg.cost);
      }
    }
  }

  /** Smart Focus switch plus the per-tower "who do I buff first" picker (single-target buff towers only). */
  private renderTargetPriorityPicker(tower: TowerInstance, isOwner: boolean): string {
    // Blizzard Frost is AoE: it chills everyone in range, so there's nothing to prioritise
    if (!hasTargetPriority(tower.type) || (tower.type === TowerType.FROST && tower.currentBranch === UpgradeBranch.BRANCH_B)) return '';

    const smartOn = this.towerManager.smartFocusEnabled;
    const autoOrder = (AUTO_TARGET_ORDER[tower.type] ?? []).map(c => c.charAt(0) + c.slice(1).toLowerCase()).join(' → ');
    const chips = TARGET_PRIORITIES.map(p => {
      const title = p.id === 'AUTO' ? `Auto: ${autoOrder} → Recruits` : p.hint;
      return `<button class="target-chip ${tower.targetPriority === p.id ? 'active' : ''}" data-priority="${p.id}" title="${escapeHtml(title)}" ${isOwner ? '' : 'disabled'}>${p.label}</button>`;
    }).join('');

    return `
      <div class="target-picker ${smartOn ? '' : 'smart-off'}">
        <div id="btn-card-smart-focus" class="target-picker-head" title="Click or press Z to toggle Smart Focus for your team">
          <span>🎯 Smart Focus: <strong>${smartOn ? 'ON' : 'OFF (lead unit)'}</strong></span>
          <span class="key-badge" style="margin: 0;">Z</span>
        </div>
        <div class="target-picker-label">Buff first${tower.targetPriority === 'AUTO' ? `: <span>${autoOrder}</span>` : ''}</div>
        <div class="target-chips">${chips}</div>
      </div>
    `;
  }

  hideTowerCard() {
    this.towerCardEl.style.display = 'none';
  }

  isGuardianCardOpen(): boolean {
    return this.guardianCardEl.style.display !== 'none';
  }

  hideGuardianCard() {
    this.guardianCardEl.style.display = 'none';
  }

  showGuardianCard(
    guardian: PortalGuardian,
    playerGold: number,
    onUpgrade: (type: 'damage' | 'range') => void,
    onClose?: () => void
  ) {
    this.guardianCardEl.style.display = 'block';

    const curDmg = guardian.getDamage();
    const nextDmg = guardian.getNextDamage();
    const dmgCost = guardian.getDamageUpgradeCost();
    const isDmgMax = nextDmg === null;

    const curRange = guardian.getRange();
    const nextRange = guardian.getNextRange();
    const rangeCost = guardian.getRangeUpgradeCost();
    const isRangeMax = nextRange === null;

    this.guardianCardEl.innerHTML = `
      <div class="card-header border-b border-sky-800/50 pb-2 mb-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">🏹</span>
          <div>
            <div class="card-title text-sky-200 font-bold text-base leading-tight">${guardian.name}</div>
            <div class="text-[11px] text-sky-400/80 font-medium">Arcane Siege Ballista</div>
          </div>
        </div>
        <button class="close-btn text-slate-400 hover:text-white" id="btn-close-guardian">✕</button>
      </div>

      <!-- Quick Role Info -->
      <div class="text-[11px] text-slate-300 bg-sky-950/40 p-2 rounded-lg border border-sky-800/40 mb-3">
        🛡️ Heavy fortified siege ballista defending the Arrival Portal. Automatically fires enchanted broadhead greatbolts at invading enemies!
      </div>

      <!-- Upgrade Options -->
      <div class="space-y-2.5 mb-3">
        <!-- Damage Upgrade -->
        <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/80 shadow-inner">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs font-bold text-amber-300">⚔️ Greatbolt Damage (Lv. ${guardian.damageLevel}/10)</span>
            ${isDmgMax ? '<span class="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700/50">MAX</span>' : ''}
          </div>
          <div class="flex justify-between text-xs text-slate-300 mb-2">
            <span>Power: <strong class="text-white">${curDmg}</strong> dmg/bolt</span>
            ${!isDmgMax ? `<span class="text-emerald-400 font-semibold">➔ ${nextDmg} dmg (+${nextDmg! - curDmg})</span>` : ''}
          </div>
          ${!isDmgMax ? `
            <button id="btn-upg-guardian-dmg" class="upgrade-btn w-full ${playerGold < dmgCost ? 'disabled' : ''}">
              <div class="flex justify-between items-center">
                <span class="upg-name text-xs font-bold">Temper Bolt Damage</span>
                <span class="upg-cost text-xs font-bold text-amber-300">🪙 ${dmgCost}g</span>
              </div>
            </button>
          ` : ''}
        </div>

        <!-- Range Upgrade -->
        <div class="bg-slate-900/80 p-2.5 rounded-lg border border-slate-700/80 shadow-inner">
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs font-bold text-cyan-300">🎯 Ballista Reach (Lv. ${guardian.rangeLevel}/10)</span>
            ${isRangeMax ? '<span class="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-700/50">MAX</span>' : ''}
          </div>
          <div class="flex justify-between text-xs text-slate-300 mb-2">
            <span>Reach: <strong class="text-white">${curRange.toFixed(1)}m</strong></span>
            ${!isRangeMax ? `<span class="text-cyan-400 font-semibold">➔ ${nextRange!.toFixed(1)}m (+${(nextRange! - curRange).toFixed(1)}m)</span>` : ''}
          </div>
          ${!isRangeMax ? `
            <button id="btn-upg-guardian-range" class="upgrade-btn w-full ${playerGold < rangeCost ? 'disabled' : ''}">
              <div class="flex justify-between items-center">
                <span class="upg-name text-xs font-bold">Extend Draw Range</span>
                <span class="upg-cost text-xs font-bold text-amber-300">🪙 ${rangeCost}g</span>
              </div>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Live Performance Stats -->
      <div class="bg-slate-950/70 p-2 rounded-lg border border-slate-800 text-[11px] text-slate-400">
        <div class="font-bold text-slate-300 mb-1">📊 Ballista Combat Record:</div>
        <div class="flex justify-between">
          <span>Damage Dealt:</span>
          <span id="guardian-stat-dmg" class="font-mono text-amber-400 font-bold">${guardian.totalDamageDealt.toLocaleString()}</span>
        </div>
        <div class="flex justify-between">
          <span>Enemies Vanquished:</span>
          <span id="guardian-stat-kills" class="font-mono text-emerald-400 font-bold">${guardian.totalKills}</span>
        </div>
        <div class="flex justify-between">
          <span>Greatbolts Launched:</span>
          <span id="guardian-stat-shots" class="font-mono text-sky-400 font-bold">${guardian.shotsFired}</span>
        </div>
      </div>
    `;

    // Hook buttons
    this.guardianCardEl.querySelector('#btn-close-guardian')?.addEventListener('click', () => {
      this.hideGuardianCard();
      if (onClose) onClose();
    });

    const dmgBtn = this.guardianCardEl.querySelector<HTMLButtonElement>('#btn-upg-guardian-dmg');
    if (dmgBtn && !isDmgMax) {
      dmgBtn.addEventListener('click', () => {
        if (playerGold >= dmgCost) {
          onUpgrade('damage');
        }
      });
    }

    const rangeBtn = this.guardianCardEl.querySelector<HTMLButtonElement>('#btn-upg-guardian-range');
    if (rangeBtn && !isRangeMax) {
      rangeBtn.addEventListener('click', () => {
        if (playerGold >= rangeCost) {
          onUpgrade('range');
        }
      });
    }
  }

  updateGuardianCardLiveStats(guardian: PortalGuardian | null, playerGold: number) {
    if (!this.isGuardianCardOpen() || !guardian) return;

    const dmgEl = this.guardianCardEl.querySelector('#guardian-stat-dmg');
    if (dmgEl) dmgEl.textContent = guardian.totalDamageDealt.toLocaleString();

    const killsEl = this.guardianCardEl.querySelector('#guardian-stat-kills');
    if (killsEl) killsEl.textContent = guardian.totalKills.toString();

    const shotsEl = this.guardianCardEl.querySelector('#guardian-stat-shots');
    if (shotsEl) shotsEl.textContent = guardian.shotsFired.toString();

    // Toggle button affordances
    const dmgBtn = this.guardianCardEl.querySelector<HTMLButtonElement>('#btn-upg-guardian-dmg');
    if (dmgBtn) {
      dmgBtn.classList.toggle('disabled', playerGold < guardian.getDamageUpgradeCost());
    }

    const rangeBtn = this.guardianCardEl.querySelector<HTMLButtonElement>('#btn-upg-guardian-range');
    if (rangeBtn) {
      rangeBtn.classList.toggle('disabled', playerGold < guardian.getRangeUpgradeCost());
    }
  }

  showUnitCard(unit: Unit) {
    this.unitCardEl.style.display = 'block';

    const hpRatio = Math.round((unit.currentHp / unit.maxHp) * 100);
    const armorReduction = Math.round(((unit.armor * 0.06) / (1 + unit.armor * 0.06)) * 100);

    const buffsList = unit.buffHistory.length > 0
      ? unit.buffHistory.map(b => `<span class="buff-tag">${b}</span>`).join(' ')
      : '<em>No tower buffs yet</em>';

    const slowInfo = unit.slowTimer > 0
      ? `<div class="text-cyan-400">Chilled: -${Math.round(unit.slowFactor * 100)}% Speed (${unit.slowTimer.toFixed(1)}s)</div>`
      : '';

    const stackingInfo = (unit.stackingLifebloom > 0 || unit.stackingArmor > 0 || unit.stackingAttack > 0)
      ? `
        <div class="stacking-bonus-box">
          <div class="font-bold text-amber-300">Round End Bonuses:</div>
          ${unit.stackingLifebloom > 0 ? `<div>🌱 +${unit.stackingLifebloom} Max HP</div>` : ''}
          ${unit.stackingArmor > 0 ? `<div>🛡️ +${unit.stackingArmor} Armor</div>` : ''}
          ${unit.stackingAttack > 0 ? `<div>⚔️ +${unit.stackingAttack} Attack</div>` : ''}
        </div>
      `
      : '';

    const championInfo = (unit.unitClass === FriendlyClass.SOLDIER || unit.unitClass === FriendlyClass.ARCHER || unit.unitClass === FriendlyClass.MAGE)
      ? `
        <div class="bg-purple-950/40 p-2 rounded border border-purple-800/40 my-2 text-xs">
          <div class="font-bold text-purple-300 mb-1">🌟 Champion Traits:</div>
          ${unit.armorAuraBonus > 0 ? `<div class="text-sky-300 font-medium">🛡️ Armor Aura: +${unit.armorAuraBonus} to nearby allies</div>` : ''}
          ${unit.rampPerHit > 0 ? `<div class="text-amber-300 font-medium">⚔️ Relentless Assault: +${+(unit.rampPerHit * 100).toFixed(2)}% dmg per hit on same target (now +${Math.round(unit.rampStacks * unit.rampPerHit * 100)}%)</div>` : ''}
          ${unit.multishotChance > 0 ? `<div class="text-emerald-300 font-medium">🏹 Multishot: ${Math.round(unit.multishotChance * 100)}% chance (${unit.multishotTargets} targets)</div>` : ''}
          ${unit.damageAuraBonus > 0 ? `<div class="text-orange-300 font-medium">⚔️ Damage Aura: +${unit.damageAuraBonus} to nearby allies</div>` : ''}
          ${unit.unitClass === FriendlyClass.MAGE ? `
            <div class="text-purple-300 font-medium">🔮 Arcane Siphon: +${unit.manaGainPerAttack} Mana per attack (${unit.mana}/${unit.maxMana} MP)</div>
            <div class="text-orange-400 font-medium">🔥 Mega Fireball: ${unit.fireballDamageMult}x Dmg across ${unit.fireballRadius}m AoE at full Mana</div>
          ` : ''}
        </div>
      `
      : '';

    const activeAuraInfo = (unit.combatAuraArmor > 0 || unit.combatAuraAttack > 0)
      ? `
        <div class="bg-blue-950/40 p-1.5 rounded border border-blue-800/40 my-1 text-[11px] text-blue-300 font-semibold">
          ✨ Receiving Auras: ${unit.combatAuraArmor > 0 ? `+${unit.combatAuraArmor} Armor ` : ''}${unit.combatAuraAttack > 0 ? `+${unit.combatAuraAttack} Attack` : ''}
        </div>
      `
      : '';

    this.unitCardEl.innerHTML = `
      <div class="card-header">
        <div class="card-title ${unit.isFriendly ? 'text-emerald-400' : 'text-red-400'}">
          ${unit.stats.name} (Tier ${unit.stats.tier})
        </div>
        <button id="btn-close-unit" class="close-btn">&times;</button>
      </div>
      <div class="unit-hp-bar-container">
        <div class="unit-hp-fill" style="width: ${hpRatio}%; background: ${unit.isFriendly ? '#22c55e' : '#ef4444'}"></div>
        <div class="unit-hp-text">${Math.max(0, Math.round(unit.currentHp))} / ${unit.maxHp} HP</div>
      </div>
      <div class="card-stats">
        <div>Armor: <strong>${unit.armor}</strong> (${armorReduction}% reduction)</div>
        <div>Attack: <strong>${unit.attack}</strong></div>
        <div>Speed: <strong>${unit.moveSpeed.toFixed(1)}</strong></div>
      </div>
      ${!unit.isFriendly && unit.stats.abilityText ? `<div class="intel-ability mb-2">✦ ${unit.stats.abilityText}</div>` : ''}
      ${slowInfo}
      ${stackingInfo}
      ${championInfo}
      ${activeAuraInfo}
      <div class="buff-history-container">
        <div class="text-xs text-slate-400 mb-1">Applied Buffs:</div>
        <div>${buffsList}</div>
      </div>
    `;

    this.unitCardEl.querySelector('#btn-close-unit')?.addEventListener('click', () => {
      this.hideUnitCard();
      this.unitManager.selectUnit(null);
    });
  }

  hideUnitCard() {
    this.unitCardEl.style.display = 'none';
  }

  showCampaignMap() {
    const totalStars = this.techTree.getTotalStarsEarned();

    let missionsHTML = '';
    CAMPAIGN_MISSIONS.forEach(mission => {
      const stars = this.techTree.missionStars[mission.id] || 0;
      const isUnlocked = mission.id === 1 || (this.techTree.missionStars[mission.id - 1] || 0) > 0;

      const starIcons = [1, 2, 3].map(i => `<span class="star-icon ${i <= stars ? 'earned' : 'empty'}">★</span>`).join('');

      missionsHTML += `
        <div class="mission-node ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="mission-header">
            <div class="mission-title">${mission.title}</div>
            <div class="mission-stars">${starIcons}</div>
          </div>
          <div class="mission-subtitle">${mission.subtitle}</div>
          <div class="mission-desc">${mission.description}</div>
          ${isUnlocked ? `<details class="mission-briefing"><summary>📜 Briefing</summary>${mission.briefing}</details>` : ''}
          <div class="mission-objectives">
            <div>1★ ${mission.starObjectives[0]}</div>
            <div>2★ ${mission.starObjectives[1]}</div>
            <div>3★ ${mission.starObjectives[2]}</div>
          </div>
          <div class="mission-actions">
            ${isUnlocked ? `<button class="btn-play-mission" data-id="${mission.id}">Deploy Mission</button>` : `<span class="locked-text">🔒 Complete Previous Mission</span>`}
          </div>
        </div>
      `;
    });

    this.campaignModalEl.style.display = 'flex';
    this.campaignModalEl.innerHTML = `
      <div class="modal-card campaign-modal">
        <div class="modal-header">
          <h2>🗺️ Campaign World Map</h2>
          <div class="stars-counter">⭐ ${totalStars} Total Stars</div>
          <button id="btn-close-campaign" class="close-btn">&times;</button>
        </div>
        <div class="missions-list">
          ${missionsHTML}
        </div>
      </div>
    `;

    this.campaignModalEl.querySelector('#btn-close-campaign')?.addEventListener('click', () => {
      this.campaignModalEl.style.display = 'none';
    });

    this.campaignModalEl.querySelectorAll('.btn-play-mission').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt((e.target as HTMLElement).getAttribute('data-id') || '1');
        const m = CAMPAIGN_MISSIONS.find(mission => mission.id === id);
        if (m) {
          this.campaignModalEl.style.display = 'none';
          this.onSelectMission(m);
        }
      });
    });
  }

  showTechTree() {
    const availableStars = this.techTree.getAvailableStars();
    let techItemsHTML = '';

    for (const [id, tech] of Object.entries(this.techTree.upgrades)) {
      const isMaxed = tech.currentLevel >= tech.maxLevel;
      const canAfford = availableStars >= tech.costPerLevel && !isMaxed;

      techItemsHTML += `
        <div class="tech-item">
          <div class="tech-info">
            <div class="tech-name">${tech.name} (Rank ${tech.currentLevel}/${tech.maxLevel})</div>
            <div class="tech-desc">${tech.description}</div>
          </div>
          <div class="tech-action">
            <button class="tech-upgrade-btn ${canAfford ? '' : 'disabled'}" data-tech="${id}">
              ${isMaxed ? 'MAXED' : `Upgrade (${tech.costPerLevel} ⭐)`}
            </button>
          </div>
        </div>
      `;
    }

    this.techModalEl.style.display = 'flex';
    this.techModalEl.innerHTML = `
      <div class="modal-card tech-modal">
        <div class="modal-header">
          <h2>🛠️ Royal Armory & Tech Tree</h2>
          <div class="stars-counter">⭐ ${availableStars} Stars Available</div>
          <button id="btn-close-tech" class="close-btn">&times;</button>
        </div>
        <div class="tech-list">
          ${techItemsHTML}
        </div>
        <div class="modal-footer">
          <button id="btn-respec-tech" class="btn-secondary">Reset All Stars (Respec)</button>
        </div>
      </div>
    `;

    this.techModalEl.querySelector('#btn-close-tech')?.addEventListener('click', () => {
      this.techModalEl.style.display = 'none';
    });

    this.techModalEl.querySelector('#btn-respec-tech')?.addEventListener('click', () => {
      this.techTree.respec();
      this.showTechTree();
    });

    this.techModalEl.querySelectorAll('.tech-upgrade-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const techId = (e.target as HTMLElement).getAttribute('data-tech');
        if (techId && this.techTree.upgrade(techId)) {
          audio.playUpgrade();
          this.showTechTree();
        }
      });
    });
  }

  showAchievementsModal(selectedCategory: AchievementCategory = AchievementCategory.ALL) {
    if (!this.achievementManager) return;
    const { unlocked, total } = this.achievementManager.getTotalTrophiesEarned();
    const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

    const categories = [
      { id: AchievementCategory.ALL, label: '🌟 All' },
      { id: AchievementCategory.ECONOMY, label: '🪙 Economy' },
      { id: AchievementCategory.COMBAT, label: '⚔️ Combat' },
      { id: AchievementCategory.TOWERS, label: '🏰 Towers' },
      { id: AchievementCategory.EVOLUTION, label: '✨ Evolution' },
      { id: AchievementCategory.CAMPAIGN, label: '👑 Campaign' }
    ];

    const tabsHTML = categories.map(cat => `
      <button class="trophy-tab-btn ${cat.id === selectedCategory ? 'active' : ''}" data-cat="${cat.id}">
        ${cat.label}
      </button>
    `).join('');

    const filtered = selectedCategory === AchievementCategory.ALL
      ? ACHIEVEMENTS
      : ACHIEVEMENTS.filter(a => a.category === selectedCategory);

    const cardsHTML = filtered.map(ach => {
      const currentVal = this.achievementManager.getMetricValue(ach.metric);
      const unlockedTier = this.achievementManager.getUnlockedTier(ach.id);
      const isCompleted = unlockedTier >= ach.tiers.length;
      const nextTierDef = ach.tiers.find(t => t.tier === unlockedTier + 1) || ach.tiers[ach.tiers.length - 1];

      // Pill badges
      const pillsHTML = ach.tiers.map(t => {
        const isUnlocked = t.tier <= unlockedTier;
        const isNext = t.tier === unlockedTier + 1;
        return `<span class="tier-pill ${isUnlocked ? 'unlocked' : (isNext ? 'next' : '')}">${t.badge} ${t.badgeName}</span>`;
      }).join('');

      // Progress bar numbers
      const targetThreshold = nextTierDef.threshold;
      const progressPercent = isCompleted ? 100 : Math.min(100, Math.floor((currentVal / targetThreshold) * 100));

      const descText = isCompleted ? `Mastered! All ${ach.tiers.length} tiers completed.` : nextTierDef.description;

      return `
        <div class="trophy-card ${isCompleted ? 'completed' : ''}">
          <div class="trophy-header">
            <div class="trophy-icon-box">${ach.icon}</div>
            <div class="trophy-title-box">
              <div class="trophy-name">
                ${ach.name}
                ${isCompleted ? '<span class="text-amber-400 font-bold text-xs">✨ MASTERED</span>' : ''}
              </div>
              <div class="trophy-desc">${descText}</div>
            </div>
          </div>

          <div class="trophy-tier-pills">
            ${pillsHTML}
          </div>

          <div class="trophy-progress-container">
            <div class="trophy-progress-labels">
              <span>Progress: <strong>${currentVal.toLocaleString()} / ${targetThreshold.toLocaleString()} ${ach.unit}</strong></span>
              <span class="text-amber-400 font-bold">${progressPercent}%</span>
            </div>
            <div class="trophy-card-bar-track">
              <div class="trophy-card-bar-fill" style="width: ${progressPercent}%;"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.trophiesModalEl.style.display = 'flex';
    this.trophiesModalEl.innerHTML = `
      <div class="modal-card trophies-modal">
        <div class="modal-header">
          <h2>🏆 Royal Hall of Trophies</h2>
          <button id="btn-close-trophies" class="close-btn">&times;</button>
        </div>

        <div class="trophies-summary-banner">
          <div class="trophies-counter">
            <span>Trophies Unlocked:</span>
            <span class="text-amber-300 font-bold text-lg">${unlocked} / ${total}</span>
            <span class="text-slate-400 text-xs">(${pct}%)</span>
          </div>
          <div class="trophies-bar-wrapper">
            <div class="trophies-bar-track">
              <div class="trophies-bar-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        </div>

        <div class="trophy-tabs">
          ${tabsHTML}
        </div>

        <div class="trophy-grid">
          ${cardsHTML}
        </div>
      </div>
    `;

    this.trophiesModalEl.querySelector('#btn-close-trophies')?.addEventListener('click', () => {
      this.trophiesModalEl.style.display = 'none';
    });

    this.trophiesModalEl.querySelectorAll('.trophy-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = (e.currentTarget as HTMLElement).getAttribute('data-cat') as AchievementCategory;
        if (cat) {
          this.showAchievementsModal(cat);
        }
      });
    });
  }

  isAchievementsModalOpen(): boolean {
    return this.trophiesModalEl?.style.display === 'flex';
  }

  closeAchievementsModal() {
    if (this.trophiesModalEl) {
      this.trophiesModalEl.style.display = 'none';
    }
  }

  private toastTimeout: any = null;

  showAchievementToast(achievement: AchievementDef, tierDef: AchievementTierDef) {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.achievementToastEl.innerHTML = `
      <div class="toast-icon">${achievement.icon}</div>
      <div class="toast-content">
        <div class="toast-tag">🏆 Achievement Unlocked! (${tierDef.badge} ${tierDef.badgeName})</div>
        <div class="toast-title">${tierDef.title}</div>
        <div class="toast-desc">${tierDef.description}</div>
      </div>
    `;

    this.achievementToastEl.classList.add('visible');
    audio.playAchievement();

    try {
      confetti({
        particleCount: 55,
        spread: 65,
        origin: { y: 0.12 }
      });
    } catch (e) {
      // Ignored if confetti unavailable
    }

    this.toastTimeout = setTimeout(() => {
      this.achievementToastEl.classList.remove('visible');
    }, 4500);
  }

  hideResultModals() {
    this.victoryModalEl.style.display = 'none';
    this.defeatModalEl.style.display = 'none';
  }

  showVictory(
    starsEarned: number,
    onNext: () => void,
    onRetry: (() => void) | null,
    labels: { next?: string; retry?: string; message?: string } = {}
  ) {
    audio.playVictory();
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });

    const starsHTML = [1, 2, 3].map(i => `<span class="victory-star ${i <= starsEarned ? 'earned' : 'empty'}">★</span>`).join('');

    this.victoryModalEl.style.display = 'flex';
    this.victoryModalEl.innerHTML = `
      <div class="modal-card victory-card">
        <h1 class="text-3xl font-bold text-yellow-400 mb-2">🏆 VICTORY!</h1>
        <p class="text-slate-300 mb-4">${labels.message ?? 'You successfully defended the realm and defeated all enemy waves!'}</p>
        <div class="victory-stars-display mb-6">${starsHTML}</div>
        <div class="modal-actions">
          ${onRetry ? `<button id="btn-vic-retry" class="btn-secondary">${labels.retry ?? 'Replay'}</button>` : ''}
          <button id="btn-vic-next" class="btn-primary">${labels.next ?? 'Next Mission'}</button>
        </div>
      </div>
    `;

    this.victoryModalEl.querySelector('#btn-vic-next')?.addEventListener('click', () => {
      this.victoryModalEl.style.display = 'none';
      onNext();
    });

    this.victoryModalEl.querySelector('#btn-vic-retry')?.addEventListener('click', () => {
      this.victoryModalEl.style.display = 'none';
      onRetry?.();
    });
  }

  showDefeat(onRetry: () => void, labels: { retry?: string; message?: string } = {}) {
    audio.playDefeat();

    this.defeatModalEl.style.display = 'flex';
    this.defeatModalEl.innerHTML = `
      <div class="modal-card defeat-card">
        <h1 class="text-3xl font-bold text-red-500 mb-2">💀 DEFEAT</h1>
        <p class="text-slate-300 mb-6">${labels.message ?? 'Your castle was overrun! Adjust your maze layout and upgrade your towers.'}</p>
        <div class="modal-actions">
          <button id="btn-def-retry" class="btn-primary">${labels.retry ?? 'Try Again'}</button>
        </div>
      </div>
    `;

    this.defeatModalEl.querySelector('#btn-def-retry')?.addEventListener('click', () => {
      this.defeatModalEl.style.display = 'none';
      onRetry();
    });
  }

  /** The boss bar's status badge: each boss shows its signature mechanic. */
  private bossBadge(boss: Unit): string {
    switch (boss.stats.passive) {
      case 'HELLFIRE_AURA':
        return boss.magmaShieldActive
          ? '<span class="boss-phase-badge p2">🔥 PHASE 2: MAGMA SHIELD (+15 ARMOR)</span>'
          : '<span class="boss-phase-badge p1">⚔️ PHASE 1: INFERNAL OVERLORD</span>';
      case 'COLOSSUS_PLATING':
        return `<span class="boss-phase-badge ${boss.armor <= 30 ? 'p2' : 'p1'}">🛡️ PLATING: ${Math.round(boss.armor)} ARMOR</span>`;
      case 'SUMMON_GOBLINS':
        return '<span class="boss-phase-badge p1">📯 WAR HORN: SUMMONS GOBLINS</span>';
      case 'BURROW':
        return '<span class="boss-phase-badge p1">🐍 BURROWS UNDER YOUR BACKLINE</span>';
      case 'REWRITE':
        return '<span class="boss-phase-badge p1">🌀 REALITY REWRITE</span>';
      default:
        return '';
    }
  }

  updateBossBar(bossUnit: Unit | null) {
    if (!bossUnit || bossUnit.isDead || bossUnit.isDying) {
      this.grandBossBarEl.style.display = 'none';
      return;
    }
    this.grandBossBarEl.style.display = 'flex';
    const hpRatio = Math.max(0, Math.min(1, bossUnit.currentHp / bossUnit.maxHp));
    const pct = Math.round(hpRatio * 100);
    const phase2Badge = this.bossBadge(bossUnit);

    this.grandBossBarEl.innerHTML = `
      <div class="boss-bar-header">
        <span class="boss-title">👹 ${bossUnit.stats.name}</span>
        ${phase2Badge}
        <span class="boss-hp-counter">${Math.max(0, Math.round(bossUnit.currentHp))} / ${bossUnit.maxHp} HP</span>
      </div>
      <div class="boss-bar-track">
        <div class="boss-bar-fill" style="width: ${pct}%;"></div>
      </div>
    `;
  }

  toggleWaveIntel(mission?: CampaignMission, waveIdx?: number) {
    if (this.waveIntelModalEl.style.display === 'flex') {
      this.waveIntelModalEl.style.display = 'none';
    } else {
      const m = mission || this.currentMission;
      const wIdx = waveIdx !== undefined ? waveIdx : (this.currentWave - 1);
      if (m) this.showWaveIntel(m, wIdx);
    }
  }

  showWaveIntel(mission: CampaignMission, waveIdx: number) {
    const wave = mission.waves[waveIdx];
    if (!wave) return;

    // Show the stats enemies will actually spawn with (wave scaling from wave 8, plus the mission's difficulty)
    const scaling = getEnemyWaveScaling(waveIdx, mission.enemyStatMult);
    const isScaled = scaling.hpMult > 1 || scaling.armorBonus > 0;
    const groups = wave.enemies.map(group => {
      const base = ENEMY_UNIT_STATS[group.enemyClass];
      return {
        group,
        base,
        hp: Math.round(base.hp * scaling.hpMult),
        armor: base.armor + scaling.armorBonus,
        attack: Math.round(base.attack * scaling.atkMult)
      };
    });
    type Group = typeof groups[number];

    const totalEnemies = groups.reduce((sum, g) => sum + g.group.count, 0);
    const totalHpPool = groups.reduce((sum, g) => sum + g.hp * g.group.count, 0);
    const totalBounty = groups.reduce(
      (sum, g) => sum + getKillBounty(g.base, g.base.isBoss === true) * g.group.count, 0);

    const battalionsHTML = groups.map(g => `
        <div class="intel-battalion-card">
          <div class="intel-battalion-header">
            <span class="font-bold text-amber-300 text-sm">${g.base.name}</span>
            <span class="intel-count-badge">x${g.group.count}</span>
          </div>
          <div class="intel-battalion-stats">
            <div>HP: <strong class="text-emerald-400">${g.hp.toLocaleString()}</strong></div>
            <div>Armor: <strong class="text-sky-300">${g.armor}</strong> (blocks ${Math.round(armorReduction(g.armor) * 100)}%)</div>
            <div>Attack: <strong class="text-rose-400">${g.attack}</strong> / ${g.base.attackRate}s</div>
            <div>Range: <strong>${g.base.range <= 1.2 ? 'Melee' : g.base.range + 'm'}</strong></div>
          </div>
          <div class="intel-desc">${g.base.description}</div>
          ${g.base.abilityText && !g.base.isBoss ? `<div class="intel-ability">✦ ${g.base.abilityText}</div>` : ''}
        </div>
      `).join('');

    // Scout advice: one box per threat present in this wave
    const namesWhere = (pred: (g: Group) => boolean) => groups.filter(pred).map(g => g.base.name).join(', ');
    const threats: { title: string; body: string; boss?: boolean }[] = [];

    for (const boss of groups.filter(g => g.base.isBoss)) {
      threats.push({
        boss: true,
        title: `⚠️ BOSS: ${boss.base.name.toUpperCase()}`,
        body: `${boss.base.abilityText ?? boss.base.description} Paralyzing Arc stuns pause boss abilities.`
      });
    }
    const heavy = groups.filter(g => g.armor >= 25);
    if (heavy.length > 0) {
      const maxArmor = Math.max(...heavy.map(g => g.armor));
      threats.push({
        title: '🛡️ HEAVY ARMOR',
        body: `${heavy.map(g => g.base.name).join(', ')}: up to ${maxArmor} Armor blocks ${Math.round(armorReduction(maxArmor) * 100)}% of every hit. ` +
          'Counter: Archer Sundering Shot strips armor for your whole army, and Relentless Assault ramps against a single tank.'
      });
    }
    const rushers = namesWhere(g => g.base.moveSpeed >= 2.7);
    if (rushers) {
      threats.push({
        title: '⚡ FAST, HARD HITTERS',
        body: `${rushers} close the gap quickly and attack rapidly. ` +
          "Counter: Iron Forge armor and Soldier Armor Aura cut every hit; Spiked Bulwark's flat reduction and Thorns punish many small hits."
      });
    }
    const ranged = namesWhere(g => g.base.range > 2.0);
    if (ranged) {
      threats.push({
        title: '🏹 RANGED BACKLINE',
        body: `${ranged} shoot from behind their front line but have little HP. ` +
          'Counter: Archers (5.5m range) outrange them; Mega Fireball splash and Multishot clean up the back rows.'
      });
    }
    if (totalEnemies >= 20) {
      threats.push({
        title: '👥 LARGE HORDE',
        body: `${totalEnemies} enemies: splash damage (Mega Fireball, Multishot) pays off, and extra Recruits help hold the line.`
      });
    }
    if (threats.length === 0) {
      threats.push({
        title: '⚔️ STANDARD VANGUARD',
        body: 'No special threats. Keep your Shrines, Forges and Obelisks feeding every recruit that walks the maze.'
      });
    }

    const tacticalAdvice = threats.map(t => `
        <div class="tactical-box ${t.boss ? 'boss-threat' : ''}">
          <div class="tactical-title">${t.title}</div>
          <div class="tactical-body">${t.body}</div>
        </div>
      `).join('');

    this.waveIntelModalEl.style.display = 'flex';
    this.waveIntelModalEl.innerHTML = `
      <div class="modal-card wave-intel-modal">
        <div class="modal-header">
          <h2>👁️ Scout Forecast: Wave ${wave.waveNumber} / ${mission.waves.length}</h2>
          <button id="btn-close-intel" class="close-btn">&times;</button>
        </div>
        <div class="wave-summary-bar">
          <div>Enemies: <strong class="text-amber-400">${totalEnemies}</strong></div>
          <div>Total HP: <strong class="text-emerald-400">${totalHpPool.toLocaleString()}</strong></div>
          <div>Kill Bounties: <strong class="text-yellow-300">🪙${totalBounty}g</strong></div>
          <div>Clear Reward: <strong class="text-yellow-300">🪙${wave.rewardGold}g</strong></div>
        </div>
        ${isScaled ? `
          <div class="intel-scaling-note">
            📈 Wave scaling: +${Math.round((scaling.hpMult - 1) * 100)}% HP, +${scaling.armorBonus} Armor, +${Math.round((scaling.atkMult - 1) * 100)}% Attack (included above)
          </div>
        ` : ''}
        <div class="intel-battalions-grid">
          ${battalionsHTML}
        </div>
        <div class="tactical-list">${tacticalAdvice}</div>
        <div class="intel-scaling-note">⏱️ Clashes lasting over 45s escalate: all unit damage x2, doubling every 15s.</div>
        <div class="modal-footer">
          <button id="btn-dismiss-intel" class="btn-primary">Acknowledge Intel</button>
        </div>
      </div>
    `;

    this.waveIntelModalEl.querySelector('#btn-close-intel')?.addEventListener('click', () => {
      this.waveIntelModalEl.style.display = 'none';
    });
    this.waveIntelModalEl.querySelector('#btn-dismiss-intel')?.addEventListener('click', () => {
      this.waveIntelModalEl.style.display = 'none';
    });
  }

  showTutorialModal(force: boolean = false) {
    if (!force) {
      const alreadySeen = localStorage.getItem('forgebound_td_tutorial_seen') || localStorage.getItem('pyro_td_tutorial_seen');
      if (alreadySeen === 'true') return;
    }

    this.tutorialModalEl.style.display = 'flex';
    this.tutorialModalEl.innerHTML = `
      <div class="modal-card tutorial-modal">
        <div class="modal-header">
          <div>
            <h2 class="tutorial-headline">🛡️ Commander's War Briefing: Reverse Tower Defense</h2>
            <div class="tutorial-subline">Welcome to Forgebound TD! Master the maze to forge an invincible army.</div>
          </div>
          <button id="btn-close-tutorial" class="close-btn" title="Close Guide">&times;</button>
        </div>

        <div class="tutorial-grid">
          <!-- 1. The Reverse TD Rule -->
          <div class="tutorial-card">
            <div class="tutorial-card-title text-emerald-400">
              <span class="icon">🏰</span> 1. The Reverse TD Mechanic
            </div>
            <div class="tutorial-card-body">
              Your recruits spawn from the <strong>Player Castle</strong> severely wounded with only <strong>1 HP</strong>!<br/><br/>
              Instead of placing towers to kill enemies, <strong>you construct a maze of shrines & forges to heal, armor, and empower your own recruits</strong> before they reach the Teleportation Gate.
            </div>
          </div>

          <!-- 2. Tower Blessings -->
          <div class="tutorial-card">
            <div class="tutorial-card-title text-sky-400">
              <span class="icon">✨</span> 2. Towers & Blessings
            </div>
            <div class="tutorial-card-body">
              • <strong>Vitality Shrine (1):</strong> Heals units & increases max HP ceiling.<br/>
              • <strong>Iron Forge (2):</strong> Tempers armor for heavy damage reduction.<br/>
              • <strong>Flame Obelisk (3):</strong> Bestows raw attack power & attack speed.<br/>
              • <strong>Frost Tower (5):</strong> Chills recruits to walk slower, absorbing more buffs per tile!<br/>
              • <strong>Evolution Chamber (8):</strong> Ascends 250+ HP units into mighty Champions!
            </div>
          </div>

          <!-- 3. The Arena Clash -->
          <div class="tutorial-card">
            <div class="tutorial-card-title text-rose-400">
              <span class="icon">⚔️</span> 3. The Arena Clash & Bosses
            </div>
            <div class="tutorial-card-body">
              Upon passing through the <strong>Teleportation Gate</strong>, your buffed units warp directly into the <strong>Arena Island</strong>.<br/><br/>
              When all units assemble, the gates open and battle commences! Slay all enemy raiders to claim victory and gold bounties, but beware: every mission ends with its own <strong>boss</strong> at Wave 25!<br/><br/>
              🏛️ <strong>Portal Guardians:</strong> Click the two Bastions flanking the Arrival Portal to upgrade their <strong>Damage</strong> and <strong>Range</strong> with gold for crucial artillery fire support!
            </div>
          </div>

          <!-- 4. Hotkeys & Strategic Controls -->
          <div class="tutorial-card">
            <div class="tutorial-card-title text-amber-400">
              <span class="icon">⌨️</span> 4. Hotkeys & Strategic Controls
            </div>
            <div class="tutorial-card-body hotkeys-list">
              <div><kbd>Space</kbd> / <kbd>Enter</kbd> : Release Wave</div>
              <div><kbd>1</kbd> - <kbd>8</kbd> : Build Towers / Choose Upgrades</div>
              <div><kbd>F</kbd> : Focus Fire (Towers in range prioritize clicked enemy)</div>
              <div><kbd>R</kbd> : Recruit +1 Soldier for next wave</div>
              <div><kbd>I</kbd> : Enemy Wave Intel & Scout Forecast</div>
              <div><kbd>Tab</kbd> : Cycle Speed (1x / 2x / 4x)</div>
              <div><kbd>H</kbd> / <kbd>?</kbd> : Reopen this Tutorial Guide</div>
            </div>
          </div>
        </div>

        <div class="tutorial-footer">
          <label class="tutorial-checkbox-label">
            <input type="checkbox" id="chk-dont-show-again" checked />
            <span>Don't show automatically on start</span>
          </label>
          <button id="btn-start-playing" class="btn-primary">Got It, Let's Battle! ⚔️</button>
        </div>
      </div>
    `;

    const close = () => {
      const chk = this.tutorialModalEl.querySelector<HTMLInputElement>('#chk-dont-show-again');
      if (chk && chk.checked) {
        localStorage.setItem('forgebound_td_tutorial_seen', 'true');
      } else {
        localStorage.removeItem('forgebound_td_tutorial_seen');
        localStorage.removeItem('pyro_td_tutorial_seen');
      }
      this.tutorialModalEl.style.display = 'none';
    };

    this.tutorialModalEl.querySelector('#btn-close-tutorial')?.addEventListener('click', close);
    this.tutorialModalEl.querySelector('#btn-start-playing')?.addEventListener('click', close);
  }
}

