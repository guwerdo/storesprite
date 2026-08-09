export interface IProfileUser {
  id?: string;
  fullName?: string | null;
  firstName?: string | null;
  primaryEmailAddress?: { emailAddress?: string } | null;
  createdAt?: number | Date | null;
  lastSignInAt?: number | Date | null;
  imageUrl?: string;
}

export interface IProfileFieldDefinition {
  label: string;
  labelKey?: string;
  getValue: (user?: IProfileUser | null) => string;
}
