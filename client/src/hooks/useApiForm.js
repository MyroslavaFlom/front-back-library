import { useState } from 'react';
import { ApiError } from '../api/index.js';

// Стан форми + розбір помилок API: details з відомим field → біля поля, решта — загальною помилкою.
export function useApiForm(initialValues) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = (next = initialValues) => {
    setValues(next);
    setFieldErrors({});
    setError(null);
  };

  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    isInvalid: Boolean(fieldErrors[name]),
    onChange: (e) => {
      const { value } = e.target;
      setValues((v) => ({ ...v, [name]: value }));
      setFieldErrors(({ [name]: _removed, ...rest }) => rest);
    },
  });

  // Виконує action(values); повертає результат або undefined, якщо була помилка.
  const submit = async (action) => {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      return await action(values);
    } catch (err) {
      const byField = {};
      const rest = [];
      if (err instanceof ApiError) {
        for (const d of err.details ?? []) {
          if (d.field && d.field in values && !byField[d.field]) byField[d.field] = d.message;
          else rest.push(d);
        }
      }
      setFieldErrors(byField);
      // Загальна помилка показується, якщо не все вдалося прив'язати до полів.
      if (Object.keys(byField).length === 0 || rest.length > 0) {
        setError(err instanceof ApiError ? new ApiError(err.status, err.message, rest) : err);
      }
      return undefined;
    } finally {
      setSubmitting(false);
    }
  };

  return { values, setValues, fieldErrors, error, setError, submitting, bind, submit, reset };
}
