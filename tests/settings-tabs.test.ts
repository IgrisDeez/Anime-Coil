import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ui } from '../src/ui.ts';
import { SETTINGS_TABS, restoreDialogFocus, selectSettingsTab, settingsTabForKey } from '../src/settings-tabs.ts';

test('Settings tabs follow arrow, Home, and End navigation', () => {
  assert.equal(settingsTabForKey('controls', 'ArrowLeft'), 'accessibility');
  assert.equal(settingsTabForKey('accessibility', 'ArrowRight'), 'controls');
  assert.equal(settingsTabForKey('audio', 'Home'), 'controls');
  assert.equal(settingsTabForKey('controls', 'End'), 'accessibility');
  assert.equal(settingsTabForKey('audio', 'Space'), null);
});

test('only the active Settings panel is exposed and tabbable', () => {
  const tabs = new Map<string, { attributes: Record<string, string>; tabIndex: number; focused: boolean; setAttribute(name: string, value: string): void; focus(): void }>();
  const panels = new Map<string, { hidden: boolean }>();
  for (const id of SETTINGS_TABS) {
    tabs.set(id, { attributes: {}, tabIndex: -1, focused: false,
      setAttribute(name, value) { this.attributes[name] = value; }, focus() { this.focused = true; } });
    panels.set(id, { hidden: id !== 'controls' });
  }
  const scroll = { scrollTop: 23 };
  const dialog = { querySelector(selector: string) {
    if (selector === '.settings-scroll') return scroll;
    return selector.startsWith('#settings-tab-') ? tabs.get(selector.slice(14)) : panels.get(selector.slice(16));
  } } as unknown as HTMLDialogElement;
  selectSettingsTab(dialog, 'audio', true);
  for (const id of SETTINGS_TABS) {
    assert.equal(tabs.get(id)!.attributes['aria-selected'], String(id === 'audio'));
    assert.equal(tabs.get(id)!.tabIndex, id === 'audio' ? 0 : -1);
    assert.equal(panels.get(id)!.hidden, id !== 'audio');
  }
  assert.equal(tabs.get('audio')!.focused, true);
  assert.equal(scroll.scrollTop, 0);
});

test('Settings markup labels tabs and starts with only Controls visible', () => {
  for (const id of SETTINGS_TABS) {
    assert.match(ui, new RegExp(`id="settings-tab-${id}" role="tab"[^>]+aria-controls="settings-panel-${id}"`));
    assert.match(ui, new RegExp(`id="settings-panel-${id}"[^>]+role="tabpanel"[^>]+aria-labelledby="settings-tab-${id}"`));
  }
  assert.match(ui, /id="settings-panel-controls"[^>]+tabindex="0"><h3>/);
  for (const id of SETTINGS_TABS.slice(1)) assert.match(ui, new RegExp(`id="settings-panel-${id}"[^>]+ hidden>`));
});

test('closing a dialog returns focus to a connected opener', () => {
  let focused = 0;
  restoreDialogFocus({ isConnected: true, focus() { focused++; } } as unknown as HTMLElement);
  restoreDialogFocus({ isConnected: false, focus() { focused++; } } as unknown as HTMLElement);
  restoreDialogFocus();
  assert.equal(focused, 1);
});
