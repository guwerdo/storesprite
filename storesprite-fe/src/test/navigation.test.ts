import { describe, it, expect } from 'vitest';
import { DRAWER_NAV_ITEMS } from '../config/navigation.js';
import { USER_MENU_ITEMS } from '../config/userMenu.js';

describe('Navigation Configurations', () => {
  it('defines the 3 drawer navigation items in correct order', () => {
    expect(DRAWER_NAV_ITEMS).toHaveLength(3);
    expect(DRAWER_NAV_ITEMS[0].label).toBe('Stock Sprite');
    expect(DRAWER_NAV_ITEMS[0].path).toBe('/');
    expect(DRAWER_NAV_ITEMS[1].label).toBe('Store Chat AI');
    expect(DRAWER_NAV_ITEMS[1].path).toBe('/chat');
    expect(DRAWER_NAV_ITEMS[2].label).toBe('Search Sprite AI');
    expect(DRAWER_NAV_ITEMS[2].path).toBe('/search');
  });

  it('defines user menu items with Profile and Settings', () => {
    const labels = USER_MENU_ITEMS.map((item) => item.label);
    expect(labels).toContain('Profile');
    expect(labels).toContain('Settings');
  });
});
