import { NetworkManager } from '../network/NetworkManager';
import { MERCENARY_DEFINITIONS, MercenaryDef } from '../network/NetworkTypes';
import { EnemyClass } from '../units/UnitData';
import { audio } from '../engine/AudioSystem';

export class MercenaryMenu {
  private container: HTMLElement;
  private network: NetworkManager;
  private menuEl: HTMLElement;
  public visible: boolean = false;

  constructor(container: HTMLElement, network: NetworkManager) {
    this.container = container;
    this.network = network;

    this.menuEl = document.createElement('div');
    this.menuEl.className = 'merc-panel';
    this.menuEl.style.display = 'none';
    this.container.appendChild(this.menuEl);
  }

  public show() {
    this.visible = true;
    this.menuEl.style.display = 'flex';
    this.render();
  }

  public hide() {
    this.visible = false;
    this.menuEl.style.display = 'none';
  }

  public render(playerGold?: number) {
    if (!this.visible) return;

    const localPlayer = this.network.getLocalPlayer();
    const gold = playerGold !== undefined ? playerGold : (localPlayer ? localPlayer.gold : 0);
    const income = localPlayer ? localPlayer.income : 0;
    const targetTeamName = this.network.localTeam === 'SUN' ? 'MOON' : 'SUN';

    const mercList: MercenaryDef[] = [
      MERCENARY_DEFINITIONS[EnemyClass.GOBLIN],
      MERCENARY_DEFINITIONS[EnemyClass.SKELETON_ARCHER],
      MERCENARY_DEFINITIONS[EnemyClass.ORC_WARRIOR],
      MERCENARY_DEFINITIONS[EnemyClass.SHADOW_ASSASSIN],
      MERCENARY_DEFINITIONS[EnemyClass.IRONCLAD_OGRE],
      MERCENARY_DEFINITIONS[EnemyClass.BOSS_LORD_IGNIS]
    ];

    this.menuEl.innerHTML = `
      <div class="merc-header">
        <div class="merc-title-group">
          <span class="merc-icon">⚔️</span>
          <span class="merc-title">MERCENARY RAIDS — ATTACK TEAM ${targetTeamName}</span>
        </div>
        <div class="merc-income-pill" title="Permanent gold bonus awarded to you at the end of every wave">
          <span class="income-label">Round Income:</span>
          <span class="income-val text-amber-400 font-bold">+🪙${income}g / Wave</span>
        </div>
      </div>

      <div class="merc-cards-row">
        ${mercList.map(def => {
          const canAfford = gold >= def.cost;
          return `
            <div class="merc-card ${canAfford ? '' : 'disabled'}" data-class="${def.enemyClass}" title="${def.description}">
              <div class="merc-card-top">
                <span class="merc-avatar">${def.icon}</span>
                <div class="merc-info">
                  <div class="merc-name">${def.name}</div>
                  <div class="merc-income-bonus text-emerald-400 font-bold">+🪙${def.incomeBonus}g Income</div>
                </div>
              </div>
              <button class="merc-summon-btn ${canAfford ? 'can-afford' : 'locked'}" data-class="${def.enemyClass}">
                <span class="merc-cost">🪙${def.cost}g</span>
                <span class="merc-btn-action">Summon</span>
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Attach click listeners to summon buttons
    const btns = this.menuEl.querySelectorAll('.merc-summon-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const enemyClass = (btn as HTMLElement).dataset.class as EnemyClass;
        if (enemyClass) {
          const def = MERCENARY_DEFINITIONS[enemyClass];
          if (def && gold >= def.cost) {
            this.network.sendAction({ kind: 'SEND_MERCENARY', enemyClass });
            audio.playBuild();
          } else {
            audio.playDefeat();
          }
        }
      });
    });
  }
}
