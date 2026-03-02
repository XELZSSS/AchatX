type ClassValue = ClassValue[] | Record<string, unknown> | string | undefined | null | false;

export const cn = (...values: ClassValue[]): string => {
  const classes: string[] = [];

  for (const value of values) {
    if (!value) continue;

    if (typeof value === 'string') {
      classes.push(value);
    } else if (Array.isArray(value)) {
      const inner = cn(...value);
      if (inner) classes.push(inner);
    } else if (typeof value === 'object') {
      for (const [key, condition] of Object.entries(value)) {
        if (condition) classes.push(key);
      }
    }
  }

  return classes.join(' ');
};
