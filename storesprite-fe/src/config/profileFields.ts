import type { IProfileUser, IProfileFieldDefinition } from '../types/Profile.interface.js';

export type { IProfileUser, IProfileFieldDefinition };

export const PROFILE_FIELDS: IProfileFieldDefinition[] = [
  {
    label: 'Full Name',
    labelKey: 'profile.fullName',
    getValue: (user) => user?.fullName || user?.firstName || 'N/A',
  },
  {
    label: 'Primary Email',
    labelKey: 'profile.primaryEmail',
    getValue: (user) => user?.primaryEmailAddress?.emailAddress || 'N/A',
  },
  {
    label: 'User ID',
    labelKey: 'profile.userId',
    getValue: (user) => user?.id || 'N/A',
  },
  {
    label: 'Registration Date',
    labelKey: 'profile.registrationDate',
    getValue: (user) => (user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'),
  },
  {
    label: 'Last Sign In',
    labelKey: 'profile.lastSignIn',
    getValue: (user) => (user?.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : 'N/A'),
  },
];
