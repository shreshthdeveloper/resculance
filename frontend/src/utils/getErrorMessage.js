export default function getErrorMessage(error, fallback) {
  if (!error) return fallback || 'Something went wrong';
  const data = error.response?.data;
  return data?.error || data?.message || error.message || fallback || 'Something went wrong';
}
