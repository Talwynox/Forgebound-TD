import confetti from 'canvas-confetti';
import { TowerType, UpgradeBranch, TOWER_DEFINITIONS, TowerDef } from '../towers/TowerData';
import { TowerInstance, TowerManager } from '../towers/TowerManager';
import { Unit, UnitManager } from '../units/UnitManager';
import { CAMPAIGN_MISSIONS, CampaignMission } from '../campaign/CampaignData';
import { TechTreeManager } from '../campaign/TechTree';
import { audio } from '../engine/AudioSystem';

export class UIManager {
  public domContainer: HTMLElement;
  public towerManager!: TowerManager;
  public unitManager!: UnitManager;
  public techTree!: TechTreeManager;

  // Placement state
  public selectedTowerTypeForPlacement: TowerType | null = null;

  // Callbacks to main game loop
  public onStartWave: () => void = () => {};
  public onSetGameSpeed: (speed: number) => void = () => {};
  public onSelectMission: (mission: CampaignMission) => void = () => {};

  // Elements
  private topBarEl!: HTMLElement;
  private towerPaletteEl!: HTMLElement;
  private towerCardEl!: HTMLElement;
  private unitCardEl!: HTMLElement;
  private campaignModalEl!: HTMLElement;
  private techModalEl!: HTMLElement;
  private victoryModalEl!: HTMLElement;
  private defeatModalEl!: HTMLElement;

  constructor(domContainer: HTMLElement) {
    this.domContainer = domContainer;
    this.createUIElements();
  }

  init(towerManager: TowerManager, unitManager: UnitManager, techTree: TechTreeManager) {
    this.towerManager = towerManager;
    this.unitManager = unitManager;
    this.techTree = techTree;
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
  }

  renderTopBar(
    mission: CampaignMission,
    currentWave: number,
    totalWaves: number,
    gold: number,
    castleHp: number,
    castleMaxHp: number,
    enemyCitadelHp: number,
    enemyCitadelMaxHp: number,
    gameSpeed: number,
    waveInProgress: boolean,
    phaseText: string = 'Prepare Maze'
  ) {
    const totalStars = this.techTree.getTotalStarsEarned();

    this.topBarEl.innerHTML = `
      <div class="hud-group">
        <div class="hud-mission-title">${mission.title}</div>
        <div class="hud-badge wave-badge">Wave ${currentWave} / ${totalWaves}</div>
        <div class="hud-badge phase-badge font-bold">${phaseText}</div>
      </div>

      <div class="hud-group resources">
        <div class="hud-stat" title="Gold Reserve"><span class="icon">🪙</span> <span class="val text-amber-400 font-bold">${gold}g</span></div>
        <div class="hud-stat" title="Player Castle Health"><span class="icon">🛡️</span> <span class="val text-emerald-400 font-bold">${Math.max(0, castleHp)} / ${castleMaxHp}</span></div>
        <div class="hud-stat" title="Enemy Citadel Health"><span class="icon">🔥</span> <span class="val text-red-400 font-bold">${Math.max(0, enemyCitadelHp)} / ${enemyCitadelMaxHp}</span></div>
        <div class="hud-stat" title="Campaign Stars"><span class="icon">⭐</span> <span class="val text-yellow-300 font-bold">${totalStars}</span></div>
      </div>

      <div class="hud-group controls">
        <button id="btn-speed" class="hud-btn speed-btn">${gameSpeed === 0 ? '⏸️ PAUSED' : gameSpeed + 'x'}</button>
        <button id="btn-send-wave" class="hud-btn wave-btn ${waveInProgress ? 'disabled' : ''}">
          ${waveInProgress ? '⚔️ Wave Active' : '⚔️ Release Wave'}
        </button>
        <button id="btn-tech" class="hud-btn icon-btn" title="Armory / Tech Tree">🛠️ Tech</button>
        <button id="btn-campaign" class="hud-btn icon-btn" title="Campaign Map">🗺️ Map</button>
        <button id="btn-audio" class="hud-btn icon-btn" title="Audio Toggle">${audio.enabled ? '🔊' : '🔇'}</button>
      </div>
    `;

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

    // Tech tree button
    this.topBarEl.querySelector('#btn-tech')?.addEventListener('click', () => this.showTechTree());

    // Campaign button
    this.topBarEl.querySelector('#btn-campaign')?.addEventListener('click', () => this.showCampaignMap());

    // Audio button
    this.topBarEl.querySelector('#btn-audio')?.addEventListener('click', () => {
      audio.enabled = !audio.enabled;
      this.renderTopBar(mission, currentWave, totalWaves, gold, castleHp, castleMaxHp, enemyCitadelHp, enemyCitadelMaxHp, gameSpeed, waveInProgress);
    });
  }

  renderTowerPalette() {
    this.towerPaletteEl.innerHTML = '';

    const types = [
      TowerType.SHRINE,
      TowerType.FORGE,
      TowerType.OBELISK,
      TowerType.AURA,
      TowerType.FROST,
      TowerType.RULEBREAKER,
      TowerType.GOLD,
      TowerType.EVOLUTION
    ];

    types.forEach(type => {
      const def = TOWER_DEFINITIONS[type];
      const btn = document.createElement('div');
      btn.className = `tower-btn ${this.selectedTowerTypeForPlacement === type ? 'active' : ''}`;
      btn.innerHTML = `
        <div class="tower-btn-title">${def.name.split(' ')[0]}</div>
        <div class="tower-btn-cost">🪙 ${def.cost}g</div>
        <div class="tower-tooltip">
          <strong>${def.name}</strong> (${def.cost}g)
          <div class="desc">${def.description}</div>
          <div class="branches">
            <div>⚡ <em>${def.branchA[0].badge}</em>: ${def.branchA[0].name.replace(/ I$/, '')} (${def.branchA.length} Ranks)</div>
            <div>🌱 <em>${def.branchB[0].badge}</em>: ${def.branchB[0].name.replace(/ I$/, '')} (${def.branchB.length} Ranks)</div>
          </div>
        </div>
      `;

      btn.addEventListener('click', () => {
        if (this.selectedTowerTypeForPlacement === type) {
          this.selectedTowerTypeForPlacement = null;
        } else {
          this.selectedTowerTypeForPlacement = type;
        }
        this.renderTowerPalette();
      });

      this.towerPaletteEl.appendChild(btn);
    });
  }

  showTowerCard(tower: TowerInstance, playerGold: number, onUpgrade: (branch: UpgradeBranch) => void, onSell: () => void) {
    const def = TOWER_DEFINITIONS[tower.type];
    const isUnbranched = tower.currentBranch === UpgradeBranch.NONE;

    let branchHTML = '';
    if (isUnbranched) {
      const bA = def.branchA[0];
      const bB = def.branchB[0];
      branchHTML = `
        <div class="upgrade-header">Choose Branching Path:</div>
        <div class="upgrade-options">
          <button id="btn-upg-a" class="upgrade-btn ${playerGold < bA.cost ? 'disabled' : ''}">
            <div class="upg-badge">${bA.badge} (Rank 1/${def.branchA.length})</div>
            <div class="upg-name">${bA.name}</div>
            <div class="upg-cost">🪙 ${bA.cost}g</div>
            <div class="upg-desc">${bA.description}</div>
          </button>
          <button id="btn-upg-b" class="upgrade-btn ${playerGold < bB.cost ? 'disabled' : ''}">
            <div class="upg-badge">${bB.badge} (Rank 1/${def.branchB.length})</div>
            <div class="upg-name">${bB.name}</div>
            <div class="upg-cost">🪙 ${bB.cost}g</div>
            <div class="upg-desc">${bB.description}</div>
          </button>
        </div>
      `;
    } else {
      const curUpg = this.towerManager.getCurrentUpgrade(tower);
      const next = this.towerManager.getNextUpgrade(tower);
      const branchList = tower.currentBranch === UpgradeBranch.BRANCH_A ? def.branchA : def.branchB;
      const totalRanks = branchList.length;

      let nextUpgradeHTML = '';
      if (next) {
        nextUpgradeHTML = `
          <div class="upgrade-header mt-2">Next Rank Upgrade (${tower.branchLevel + 1}/${totalRanks}):</div>
          <div class="upgrade-options">
            <button id="btn-upg-next" class="upgrade-btn ${playerGold < next.upg.cost ? 'disabled' : ''}">
              <div class="upg-badge">${next.upg.badge} (Rank ${tower.branchLevel + 1}/${totalRanks})</div>
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
      <div class="tower-buff-display mb-3">
        <div class="text-sm font-bold text-sky-400 bg-sky-950/60 p-2 rounded border border-sky-800/60 mb-1">
          ✨ ${summary.currentEffect}
        </div>
        <div class="text-xs text-slate-400 font-medium">
          📊 ${summary.lifetimeOutput}
        </div>
      </div>
      <div class="card-stats">
        <div>Range: <strong>${tower.effectiveRange.toFixed(1)}</strong></div>
        <div>Cast Interval: <strong>${tower.effectiveRate.toFixed(2)}s</strong></div>
        ${tower.auraBonusMultiplier > 0 ? `<div class="text-purple-400">Aura Haste: <strong>+${Math.round(tower.auraBonusMultiplier * 100)}%</strong></div>` : ''}
      </div>
      ${branchHTML}
      <div class="card-actions">
        <button id="btn-sell" class="sell-btn">Sell (Refund 🪙 ${refund}g)</button>
      </div>
    `;

    this.towerCardEl.querySelector('#btn-close-tower')?.addEventListener('click', () => {
      this.hideTowerCard();
      this.towerManager.selectTower(null);
    });

    if (isUnbranched) {
      this.towerCardEl.querySelector('#btn-upg-a')?.addEventListener('click', () => onUpgrade(UpgradeBranch.BRANCH_A));
      this.towerCardEl.querySelector('#btn-upg-b')?.addEventListener('click', () => onUpgrade(UpgradeBranch.BRANCH_B));
    } else {
      this.towerCardEl.querySelector('#btn-upg-next')?.addEventListener('click', () => onUpgrade(tower.currentBranch));
    }
    this.towerCardEl.querySelector('#btn-sell')?.addEventListener('click', onSell);
  }

  hideTowerCard() {
    this.towerCardEl.style.display = 'none';
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
      ${slowInfo}
      ${stackingInfo}
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

  showVictory(starsEarned: number, onNext: () => void, onRetry: () => void) {
    audio.playVictory();
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });

    const starsHTML = [1, 2, 3].map(i => `<span class="victory-star ${i <= starsEarned ? 'earned' : 'empty'}">★</span>`).join('');

    this.victoryModalEl.style.display = 'flex';
    this.victoryModalEl.innerHTML = `
      <div class="modal-card victory-card">
        <h1 class="text-3xl font-bold text-yellow-400 mb-2">🏆 VICTORY!</h1>
        <p class="text-slate-300 mb-4">You successfully defended the realm and destroyed the enemy citadel!</p>
        <div class="victory-stars-display mb-6">${starsHTML}</div>
        <div class="modal-actions">
          <button id="btn-vic-retry" class="btn-secondary">Replay</button>
          <button id="btn-vic-next" class="btn-primary">Next Mission</button>
        </div>
      </div>
    `;

    this.victoryModalEl.querySelector('#btn-vic-next')?.addEventListener('click', () => {
      this.victoryModalEl.style.display = 'none';
      onNext();
    });

    this.victoryModalEl.querySelector('#btn-vic-retry')?.addEventListener('click', () => {
      this.victoryModalEl.style.display = 'none';
      onRetry();
    });
  }

  showDefeat(onRetry: () => void) {
    audio.playDefeat();

    this.defeatModalEl.style.display = 'flex';
    this.defeatModalEl.innerHTML = `
      <div class="modal-card defeat-card">
        <h1 class="text-3xl font-bold text-red-500 mb-2">💀 DEFEAT</h1>
        <p class="text-slate-300 mb-6">Your castle was overrun! Adjust your maze layout and upgrade your towers.</p>
        <div class="modal-actions">
          <button id="btn-def-retry" class="btn-primary">Try Again</button>
        </div>
      </div>
    `;

    this.defeatModalEl.querySelector('#btn-def-retry')?.addEventListener('click', () => {
      this.defeatModalEl.style.display = 'none';
      onRetry();
    });
  }
}

