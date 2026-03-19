import { twMerge } from 'tailwind-merge';

type ClassDictionary = Record<string, unknown>;
type ClassValue = ClassValue[] | ClassDictionary | string | undefined | null | false;

const appendClassValue = (classes: string[], value: ClassValue): void => {
  if (!value) return;

  if (typeof value === 'string') {
    classes.push(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendClassValue(classes, item);
    }
    return;
  }

  for (const [key, condition] of Object.entries(value)) {
    if (condition) {
      classes.push(key);
    }
  }
};

export const cn = (...values: ClassValue[]): string => {
  const classes: string[] = [];

  for (const value of values) {
    appendClassValue(classes, value);
  }

  return twMerge(classes.join(' '));
};
