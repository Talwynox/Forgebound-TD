import { NetworkManager } from '../network/NetworkManager';
import { GameMode, TeamId, PlayerSlot, TEAM_COLORS, MAX_NAME_LENGTH } from '../network/NetworkTypes';
import { escapeHtml } from './html';
import { MAP_THEME_IDS, MAP_THEME_LABELS, LobbyTheme, isLobbyTheme } from '../engine/MapThemes';

export class MultiplayerModal {
  private container: HTMLElement;
  private network: NetworkManager;
  private modalEl: HTMLElement;
  private currentTab: 'host' | 'join' = 'host';
  private statusMessage: string | null = null;

  constructor(container: HTMLElement, network: NetworkManager) {
    this.container = container;
    this.network = network;

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-backdrop mp-modal-backdrop';
    this.modalEl.style.display = 'none';
    this.container.appendChild(this.modalEl);

    this.setupNetworkCallbacks();
  }

  private setupNetworkCallbacks() {
    this.network.onLobbyUpdated = () => {
      if (this.isOpen()) {
        this.render();
      }
    };

    this.network.conn.onStateChange = (_state, detail) => {
      const statusEl = this.modalEl.querySelector('.mp-status-msg');
      if (statusEl && detail) {
        statusEl.textContent = detail;
      }
    };
  }

  /** Shows a one-off status line (e.g. why a session ended) the next time the modal renders. */
  public setStatusMessage(message: string | null) {
    this.statusMessage = message;
    if (this.isOpen()) this.render();
  }

  public isOpen(): boolean {
    return this.modalEl.style.display === 'flex';
  }

  public open(defaultTab: 'host' | 'join' = 'host', prefillRoomCode?: string) {
    this.currentTab = defaultTab;
    this.modalEl.style.display = 'flex';
    this.render(prefillRoomCode);
  }

  public close() {
    this.modalEl.style.display = 'none';
  }

  public render(prefillRoomCode?: string) {
    const isConnected = this.network.isInRoom;
    const isHost = this.network.isHost;
    const roomCode = this.network.conn.roomCode || '';
    const mode = this.network.mode;
    const players = this.network.getPlayerList();

    const sunPlayers = players.filter(p => p.team === 'SUN');
    const moonPlayers = players.filter(p => p.team === 'MOON');
    const localPlayer = this.network.getLocalPlayer();

    this.modalEl.innerHTML = `
      <div class="mp-dialog">
        <!-- Header -->
        <div class="mp-header">
          <div class="mp-title-box">
            <span class="mp-crown">🏰</span>
            <div class="mp-title">FORGEBOUND WAR ROOM — MULTIPLAYER</div>
          </div>
          <button class="mp-close-btn" id="btn-mp-close" title="Close">✕</button>
        </div>

        <!-- Mode / Tab Nav -->
        ${!isConnected ? `
          <div class="mp-tabs">
            <button class="mp-tab ${this.currentTab === 'host' ? 'active' : ''}" id="tab-host">👑 Host Match</button>
            <button class="mp-tab ${this.currentTab === 'join' ? 'active' : ''}" id="tab-join">⚔️ Join Match</button>
          </div>
        ` : ''}

        <!-- Body -->
        <div class="mp-body">
          ${!isConnected ? this.renderPreConnectBody(prefillRoomCode) : this.renderLobbyBody(roomCode, mode, sunPlayers, moonPlayers, localPlayer, isHost)}
        </div>
      </div>
    `;

    this.attachEventListeners(prefillRoomCode);
  }

  private renderPreConnectBody(prefillRoomCode?: string): string {
    if (this.currentTab === 'host') {
      return `
        <div class="mp-section">
          <h3 class="mp-sec-title">HOST A NEW MULTIPLAYER BATTLE</h3>
          <p class="mp-sec-desc">Create a direct peer-to-peer room. Share your room code or 1-click invite link with friends to play Co-Op or 4v4 PvP.</p>

          <div class="mp-form-row">
            <label>Commander Name:</label>
            <input type="text" id="host-player-name" class="mp-input" value="${escapeHtml(this.network.localName || 'Host Commander')}" maxlength="${MAX_NAME_LENGTH}" />
          </div>

          <div class="mp-form-row">
            <label>Select Game Mode:</label>
            <div class="mp-mode-toggle">
              <button class="mp-mode-btn ${this.network.mode === 'COOP' ? 'active' : ''}" id="btn-mode-coop">
                <span class="mp-mode-icon">🤝</span>
                <span class="mp-mode-name">Co-Op Defense</span>
                <span class="mp-mode-sub">2–4 Players • Shared Stronghold</span>
              </button>
              <button class="mp-mode-btn ${this.network.mode === 'PVP' ? 'active' : ''}" id="btn-mode-pvp">
                <span class="mp-mode-icon">⚔️</span>
                <span class="mp-mode-name">4v4 Clash of Strongholds</span>
                <span class="mp-mode-sub">Up to 4v4 • Mirrored Mazes • Army vs Army</span>
              </button>
            </div>
          </div>

          <div class="mp-status-msg">${this.consumeStatus('Ready to initialize WebRTC room.')}</div>

          <button class="mp-primary-btn" id="btn-start-hosting">👑 Open Room & Create Invite Code</button>
        </div>
      `;
    } else {
      return `
        <div class="mp-section">
          <h3 class="mp-sec-title">JOIN AN EXISTING MATCH</h3>
          <p class="mp-sec-desc">Enter the 5-character Room Code given by your friend to connect directly to their battle standard.</p>

          <div class="mp-form-row">
            <label>Commander Name:</label>
            <input type="text" id="join-player-name" class="mp-input" value="${escapeHtml(this.network.localName || 'Challenger')}" maxlength="${MAX_NAME_LENGTH}" />
          </div>

          <div class="mp-form-row">
            <label>Room Code (e.g. FORGE-7X):</label>
            <input type="text" id="join-room-code" class="mp-input mp-code-input" value="${escapeHtml(prefillRoomCode || '')}" placeholder="FORGE-XXXX" maxlength="11" />
          </div>

          <div class="mp-status-msg">${this.consumeStatus('Enter room code and connect.')}</div>

          <button class="mp-primary-btn" id="btn-join-room">⚔️ Connect to Room</button>
        </div>
      `;
    }
  }

  private renderLobbyBody(
    roomCode: string,
    mode: GameMode,
    sunPlayers: PlayerSlot[],
    moonPlayers: PlayerSlot[],
    localPlayer: PlayerSlot | undefined,
    isHost: boolean
  ): string {
    const isPvp = mode === 'PVP';
    const launchBlocker = this.getLaunchBlocker();

    return `
      <div class="mp-lobby">
        <!-- Room Banner & Invite -->
        <div class="mp-room-banner">
          <div class="mp-code-pill">
            <span class="mp-code-label">ROOM CODE:</span>
            <span class="mp-code-val">${roomCode}</span>
          </div>
          <button class="mp-copy-btn" id="btn-copy-invite" title="Copy 1-click shareable invite link to clipboard">
            📋 Copy Invite Link
          </button>
          <div class="mp-lobby-mode-badge ${isPvp ? 'badge-pvp' : 'badge-coop'}">
            ${isPvp ? '⚔️ 4v4 CLASH OF STRONGHOLDS' : '🤝 CO-OP DEFENSE'}
          </div>
        </div>

        ${this.renderThemePicker(isHost)}

        <!-- Team Rosters -->
        <div class="mp-rosters ${isPvp ? 'pvp-split' : 'coop-full'}">
          <!-- Team Sun (West) -->
          <div class="mp-team-col sun-col">
            <div class="mp-team-hdr">
              <div class="mp-team-title">☀️ TEAM SUN (WEST)</div>
              ${isPvp ? `<button class="mp-switch-team-btn" id="btn-join-sun" ${localPlayer?.team === 'SUN' ? 'disabled' : ''}>${localPlayer?.team === 'SUN' ? '✓ Your Team' : 'Join Sun'}</button>` : ''}
            </div>
            <div class="mp-slots">
              ${this.renderTeamSlots('SUN', sunPlayers, 4)}
            </div>
          </div>

          <!-- Team Moon (East) - Visible in PvP -->
          ${isPvp ? `
            <div class="mp-team-col moon-col">
              <div class="mp-team-hdr">
                <div class="mp-team-title">🌙 TEAM MOON (EAST)</div>
                <button class="mp-switch-team-btn" id="btn-join-moon" ${localPlayer?.team === 'MOON' ? 'disabled' : ''}>${localPlayer?.team === 'MOON' ? '✓ Your Team' : 'Join Moon'}</button>
              </div>
              <div class="mp-slots">
                ${this.renderTeamSlots('MOON', moonPlayers, 4)}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Controls Footer -->
        <div class="mp-footer">
          <div class="mp-footer-left">
            <button class="mp-ready-btn ${localPlayer?.isReady ? 'is-ready' : ''}" id="btn-toggle-ready">
              ${localPlayer?.isReady ? '✓ READY' : '⚡ READY UP'}
            </button>
            <div class="mp-ping-pill">📶 Latency: ${this.network.conn.pingMs}ms (P2P)</div>
          </div>

          <div class="mp-footer-right">
            ${isHost ? `
              <button class="mp-launch-btn" id="btn-launch-match" ${launchBlocker ? 'disabled' : ''}>
                ${launchBlocker ?? '⚔️ LAUNCH BATTLE'}
              </button>
            ` : `
              <div class="mp-waiting-host">Waiting for Host to launch match...</div>
            `}
            <button class="mp-leave-btn" id="btn-leave-room">Leave Room</button>
          </div>
        </div>
      </div>
    `;
  }

  /** Battlefield picker: the host chooses, everyone else sees the current choice. */
  private renderThemePicker(isHost: boolean): string {
    const options: LobbyTheme[] = [...MAP_THEME_IDS, 'RANDOM'];
    const buttons = options.map(theme => {
      const label = theme === 'RANDOM' ? { name: 'Random', icon: '🎲' } : MAP_THEME_LABELS[theme];
      const active = this.network.theme === theme;
      return `
        <button class="mp-theme-btn ${active ? 'active' : ''}" data-theme="${theme}" ${isHost ? '' : 'disabled'}>
          <span class="mp-theme-icon">${label.icon}</span>
          <span class="mp-theme-name">${label.name}</span>
        </button>
      `;
    }).join('');
    return `
      <div class="mp-theme-row">
        <div class="mp-theme-label">🗺️ BATTLEFIELD ${isHost ? '' : '<span class="mp-theme-note">— chosen by the host</span>'}</div>
        <div class="mp-theme-grid">${buttons}</div>
      </div>
    `;
  }

  /** Why the host can't launch yet (button label), or null when ready. */
  private getLaunchBlocker(): string | null {
    const players = this.network.getPlayerList();
    if (this.network.mode === 'PVP' && (!players.some(p => p.team === 'SUN') || !players.some(p => p.team === 'MOON'))) {
      return '⏳ NEED PLAYERS ON BOTH TEAMS';
    }
    const unready = this.network.getUnreadyPlayers().length;
    if (unready > 0) return `⏳ WAITING FOR ${unready} PLAYER${unready > 1 ? 'S' : ''}`;
    return null;
  }

  private consumeStatus(fallback: string): string {
    const msg = this.statusMessage;
    this.statusMessage = null;
    return escapeHtml(msg ?? fallback);
  }

  private renderTeamSlots(team: TeamId, teamPlayers: PlayerSlot[], maxSlots: number): string {
    let html = '';
    for (let i = 0; i < maxSlots; i++) {
      const p = teamPlayers.find(slot => slot.slotIndex === i);
      const color = TEAM_COLORS[team][i % 4];

      if (p) {
        html += `
          <div class="mp-player-card" style="border-left-color: ${color};">
            <div class="mp-card-left">
              <div class="mp-avatar-circle" style="background-color: ${color}; color: #000;">
                ${p.isHost ? '👑' : `P${i + 1}`}
              </div>
              <div class="mp-player-info">
                <div class="mp-player-name">${escapeHtml(p.name)} ${p.peerId === this.network.localPeerId ? '<span class="you-badge">(You)</span>' : ''}</div>
                <div class="mp-player-status">${p.isHost ? 'Room Host' : 'Challenger'}</div>
              </div>
            </div>
            <div class="mp-card-right">
              <span class="mp-ready-dot ${p.isReady ? 'ready' : 'not-ready'}">${p.isReady ? 'READY' : 'WAITING'}</span>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="mp-empty-card">
            <span class="mp-empty-label">Slot ${i + 1} — Open for Ally</span>
          </div>
        `;
      }
    }
    return html;
  }

  private attachEventListeners(prefillRoomCode?: string) {
    // Close button
    this.modalEl.querySelector('#btn-mp-close')?.addEventListener('click', () => {
      this.close();
    });

    // Tab buttons
    this.modalEl.querySelector('#tab-host')?.addEventListener('click', () => {
      this.currentTab = 'host';
      this.render();
    });

    this.modalEl.querySelector('#tab-join')?.addEventListener('click', () => {
      this.currentTab = 'join';
      this.render();
    });

    // Game Mode toggles
    this.modalEl.querySelector('#btn-mode-coop')?.addEventListener('click', () => {
      this.network.setGameMode('COOP');
      this.render();
    });

    this.modalEl.querySelector('#btn-mode-pvp')?.addEventListener('click', () => {
      this.network.setGameMode('PVP');
      this.render();
    });

    // Host room action
    this.modalEl.querySelector('#btn-start-hosting')?.addEventListener('click', async () => {
      const nameInput = this.modalEl.querySelector('#host-player-name') as HTMLInputElement;
      const hostName = nameInput ? nameInput.value.trim() || 'Host Commander' : 'Host Commander';
      const btn = this.modalEl.querySelector('#btn-start-hosting') as HTMLButtonElement;
      if (btn) btn.disabled = true;

      try {
        await this.network.conn.hostRoom();
        this.network.initHostPlayer(hostName, this.network.mode);
        this.render();
      } catch (err: any) {
        this.network.leave();
        this.setStatusMessage(`Failed to host: ${err.message || err}`);
      }
    });

    // Join room action
    this.modalEl.querySelector('#btn-join-room')?.addEventListener('click', async () => {
      const nameInput = this.modalEl.querySelector('#join-player-name') as HTMLInputElement;
      const codeInput = this.modalEl.querySelector('#join-room-code') as HTMLInputElement;
      const clientName = nameInput ? nameInput.value.trim() || 'Challenger' : 'Challenger';
      const code = codeInput ? codeInput.value.trim().toUpperCase() : '';

      if (!code) {
        alert('Please enter a valid Room Code (e.g. FORGE-XXXX)!');
        return;
      }

      const btn = this.modalEl.querySelector('#btn-join-room') as HTMLButtonElement;
      if (btn) btn.disabled = true;

      try {
        await this.network.conn.joinRoom(code);
        this.network.initClientPlayer(clientName);
        this.render();
      } catch (err: any) {
        this.network.leave();
        this.currentTab = 'join';
        this.setStatusMessage(`Failed to join: ${err.message || err}`);
      }
    });

    // Copy invite link
    this.modalEl.querySelector('#btn-copy-invite')?.addEventListener('click', () => {
      const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${this.network.conn.roomCode}`;
      navigator.clipboard.writeText(inviteUrl).then(() => {
        const copyBtn = this.modalEl.querySelector('#btn-copy-invite');
        if (copyBtn) {
          copyBtn.textContent = '✓ Link Copied!';
          setTimeout(() => { copyBtn.textContent = '📋 Copy Invite Link'; }, 2000);
        }
      });
    });

    // Team switch buttons in PvP
    this.modalEl.querySelector('#btn-join-sun')?.addEventListener('click', () => {
      this.network.setLocalTeam('SUN');
      this.render();
    });

    this.modalEl.querySelector('#btn-join-moon')?.addEventListener('click', () => {
      this.network.setLocalTeam('MOON');
      this.render();
    });

    // Battlefield theme (host only)
    this.modalEl.querySelectorAll<HTMLButtonElement>('.mp-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        if (!this.network.isHost || !isLobbyTheme(theme)) return;
        this.network.setTheme(theme);
        this.render();
      });
    });

    // Ready toggle
    this.modalEl.querySelector('#btn-toggle-ready')?.addEventListener('click', () => {
      const local = this.network.getLocalPlayer();
      const newReady = !local?.isReady;
      this.network.setLocalReady(newReady);
      this.render();
    });

    // Leave room
    this.modalEl.querySelector('#btn-leave-room')?.addEventListener('click', () => {
      this.network.leave();
      this.render();
    });

    // Host Launch Match
    this.modalEl.querySelector('#btn-launch-match')?.addEventListener('click', () => {
      if (!this.network.isHost || this.getLaunchBlocker()) return;
      this.close();
      this.network.startMatch(1);
    });
  }
}
