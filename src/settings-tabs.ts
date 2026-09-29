export const SETTINGS_TABS = ['controls', 'appearance', 'audio', 'accessibility'] as const;
export type SettingsTab = typeof SETTINGS_TABS[number];

export function settingsTabForKey(current: SettingsTab, key: string): SettingsTab | null {
  const index = SETTINGS_TABS.indexOf(current);
  if (key === 'ArrowRight') return SETTINGS_TABS[(index + 1) % SETTINGS_TABS.length];
  if (key === 'ArrowLeft') return SETTINGS_TABS[(index + SETTINGS_TABS.length - 1) % SETTINGS_TABS.length];
  if (key === 'Home') return SETTINGS_TABS[0];
  if (key === 'End') return SETTINGS_TABS[SETTINGS_TABS.length - 1];
  return null;
}

export function selectSettingsTab(dialog: HTMLDialogElement, selected: SettingsTab, focus = false): void {
  for (const id of SETTINGS_TABS) {
    const tab = dialog.querySelector<HTMLButtonElement>(`#settings-tab-${id}`)!;
    const panel = dialog.querySelector<HTMLElement>(`#settings-panel-${id}`)!;
    const active = id === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    panel.hidden = !active;
    if (active && focus) tab.focus();
  }
  const scroll = dialog.querySelector<HTMLElement>('.settings-scroll');
  if (scroll) scroll.scrollTop = 0;
}

export function installSettingsTabs(dialog: HTMLDialogElement, onChange?: () => void): void {
  for (const id of SETTINGS_TABS) {
    const tab = dialog.querySelector<HTMLButtonElement>(`#settings-tab-${id}`)!;
    tab.addEventListener('click', () => { onChange?.(); selectSettingsTab(dialog, id, true); });
    tab.addEventListener('keydown', (event) => {
      const target = settingsTabForKey(id, event.key);
      if (!target) return;
      event.preventDefault();
      onChange?.();
      selectSettingsTab(dialog, target, true);
    });
  }
}

export function restoreDialogFocus(opener?: HTMLElement): void {
  if (opener?.isConnected) opener.focus();
}
