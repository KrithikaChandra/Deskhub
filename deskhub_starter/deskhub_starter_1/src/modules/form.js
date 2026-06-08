export const validators = {
  required(message = "This field is required.") {
    return (value) => (String(value).trim() ? null : message);
  },
  minLength(length, message = `Must be at least ${length} characters.`) {
    return (value) =>
      String(value).trim().length >= length ? null : message;
  },
  maxLength(length, message = `Must be ${length} characters or fewer.`) {
    return (value) =>
      String(value).trim().length <= length ? null : message;
  },
  email(message = "Enter a valid email address.") {
    return (value) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())
        ? null
        : message;
  },
  oneOf(options, message = "Choose one of the available options.") {
    const allowed = new Set(options.map(String));
    return (value) => (allowed.has(String(value)) ? null : message);
  },
};

export function validateField(field, rules) {
  const value = field.value;
  for (const rule of rules) {
    const message = rule(value);
    if (message) return message;
  }
  return "";
}

export function validateForm(form, schema) {
  const errors = {};

  for (const [name, rules] of Object.entries(schema)) {
    const field = form.elements.namedItem(name);
    if (!(field instanceof HTMLInputElement) &&
        !(field instanceof HTMLTextAreaElement) &&
        !(field instanceof HTMLSelectElement)) {
      continue;
    }

    const error = validateField(field, rules);
    if (error) errors[name] = error;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
