import type React from 'react';

export interface ITabItemConfig {
  id: string;
  label: string;
  icon?: React.ReactElement;
  content: React.ReactNode;
}

export interface ITabbedPageLayoutProps {
  title: string;
  description?: string;
  tabs: ITabItemConfig[];
  initialTab?: number;
  headerAction?: React.ReactNode;
}
