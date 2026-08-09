import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TabbedPageLayout from '../components/TabbedPageLayout.js';
import type { ITabItemConfig } from '../types/TabbedPageLayout.interface.js';
import { AppThemeProvider } from '../theme/AppThemeProvider.js';

describe('TabbedPageLayout', () => {
  const mockTabs: ITabItemConfig[] = [
    {
      id: 'tab-1',
      label: 'Main View',
      content: <div data-testid="tab-1-content">Main View Content</div>,
    },
    {
      id: 'tab-2',
      label: 'Settings',
      content: <div data-testid="tab-2-content">Settings Content</div>,
    },
  ];

  it('renders title, description, and tabs properly', () => {
    render(
      <AppThemeProvider>
        <TabbedPageLayout
          title="Stock Sprite"
          description="Test description"
          tabs={mockTabs}
        />
      </AppThemeProvider>,
    );

    expect(screen.getByRole('heading', { name: /stock sprite/i })).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /main view/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByTestId('tab-1-content')).toBeInTheDocument();
  });

  it('switches tab content when clicking on the second tab', () => {
    render(
      <AppThemeProvider>
        <TabbedPageLayout
          title="Stock Sprite"
          tabs={mockTabs}
        />
      </AppThemeProvider>,
    );

    const settingsTab = screen.getByRole('tab', { name: /settings/i });
    fireEvent.click(settingsTab);

    expect(screen.getByTestId('tab-2-content')).toBeInTheDocument();
  });
});
